// PS4 side of KokiCat (OpenOrbis homebrew): screen, controller, saves, images and HTTPS.
// The game itself is in core.c.
#include <stdbool.h> /* los headers de OpenOrbis usan bool */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <pthread.h>
#include <sys/stat.h>

#include <orbis/libkernel.h>
#include <orbis/VideoOut.h>
#include <orbis/Pad.h>
#include <orbis/UserService.h>
#include <orbis/Sysmodule.h>
#include <orbis/Http.h>
#include <orbis/Ssl.h>
#include <orbis/Net.h>

#include "platform.h"
#include "core.h"
#include "server_config.h" /* SERVER_URL y SERVER_KEY (lo genera build.ps1 desde .env) */

#define TV_W 1920
#define TV_H 1080

/* ---------- pantalla ---------- */
static int video;
static uint32_t *frame_buffers[2];
static OrbisKernelEqueue flip_queue;

static int video_init(void) {
  video = sceVideoOutOpen(ORBIS_VIDEO_USER_MAIN, ORBIS_VIDEO_OUT_BUS_MAIN, 0, 0);
  if (video < 0) return 0;
  if (sceKernelCreateEqueue(&flip_queue, "kokicat flip") < 0) return 0;
  sceVideoOutAddFlipEvent(flip_queue, video, 0);

  const size_t align = 0x200000, fb_size = (size_t)TV_W * TV_H * 4;
  size_t total = (fb_size * 2 + align - 1) / align * align;
  off_t off = 0;
  void *mem = NULL;
  if (sceKernelAllocateDirectMemory(0, sceKernelGetDirectMemorySize(), total, align, 3, &off) < 0) return 0;
  if (sceKernelMapDirectMemory(&mem, total, 0x33, 0, off, align) < 0) return 0;
  frame_buffers[0] = (uint32_t *)mem;
  frame_buffers[1] = (uint32_t *)((char *)mem + fb_size);

  OrbisVideoOutBufferAttribute attr;
  sceVideoOutSetBufferAttribute(&attr, 0x80000000, 1, 0, TV_W, TV_H, TV_W);
  if (sceVideoOutRegisterBuffers(video, 0, (void **)frame_buffers, 2, &attr) != 0) return 0;
  sceVideoOutSetFlipRate(video, 0); /* 60 por segundo */
  return 1;
}

/* el juego dibuja en 1280x720; aquí se agranda 1.5 veces a 1920x1080 */
static uint16_t src_x[TV_W];
static void present(int index, int frame_id) {
  const uint32_t *src = core_fb();
  uint32_t *dst = frame_buffers[index];
  for (int y = 0; y < TV_H; y++) {
    const uint32_t *row = src + (y * 2 / 3) * FB_W;
    uint32_t *out = dst + y * TV_W;
    for (int x = 0; x < TV_W; x++) out[x] = row[src_x[x]] | 0x80000000u;
  }
  sceVideoOutSubmitFlip(video, index, ORBIS_VIDEO_OUT_FLIP_VSYNC, frame_id);
  /* esperar a que se muestre antes de dibujar el siguiente */
  for (;;) {
    OrbisVideoOutFlipStatus st;
    sceVideoOutGetFlipStatus(video, &st);
    if (st.flipArg == frame_id) break;
    OrbisKernelEvent evt;
    int count;
    if (sceKernelWaitEqueue(flip_queue, &evt, 1, &count, 0) != 0) break;
  }
}

/* ---------- control ---------- */
static int pad = -1;
static int pad_init(void) {
  if (scePadInit() != 0) return 0;
  OrbisUserServiceInitializeParams param;
  param.priority = ORBIS_KERNEL_PRIO_FIFO_LOWEST;
  sceUserServiceInitialize(&param);
  int user = 0;
  sceUserServiceGetInitialUser(&user);
  pad = scePadOpen(user, 0, 0, NULL);
  if (pad < 0) return 0;
  /* barra de luz del control en el naranjo del atardecer de Koki */
  OrbisPadColor color = {244, 160, 106, 255};
  scePadSetLightBar(pad, &color);
  return 1;
}
static uint32_t pad_buttons(void) {
  OrbisPadData d;
  if (pad < 0 || scePadReadState(pad, &d) != 0 || !d.connected) return 0;
  uint32_t b = 0, o = d.buttons;
  if (o & ORBIS_PAD_BUTTON_CROSS) b |= BTN_CROSS;
  if (o & ORBIS_PAD_BUTTON_CIRCLE) b |= BTN_CIRCLE;
  if (o & ORBIS_PAD_BUTTON_SQUARE) b |= BTN_SQUARE;
  if (o & ORBIS_PAD_BUTTON_TRIANGLE) b |= BTN_TRIANGLE;
  if (o & ORBIS_PAD_BUTTON_L1) b |= BTN_L1;
  if (o & ORBIS_PAD_BUTTON_R1) b |= BTN_R1;
  if (o & ORBIS_PAD_BUTTON_OPTIONS) b |= BTN_OPTIONS;
  /* cruceta o joystick izquierdo */
  if ((o & ORBIS_PAD_BUTTON_UP) || d.leftStick.y < 50) b |= BTN_UP;
  if ((o & ORBIS_PAD_BUTTON_DOWN) || d.leftStick.y > 205) b |= BTN_DOWN;
  if ((o & ORBIS_PAD_BUTTON_LEFT) || d.leftStick.x < 50) b |= BTN_LEFT;
  if ((o & ORBIS_PAD_BUTTON_RIGHT) || d.leftStick.x > 205) b |= BTN_RIGHT;
  return b;
}

/* ---------- imágenes (van dentro del pkg, en /app0/assets) ---------- */
int plat_load_image(const char *name, Image *out) {
  char path[128];
  snprintf(path, sizeof path, "/app0/assets/%s.rgba", name);
  FILE *f = fopen(path, "rb");
  if (!f) return 0;
  uint32_t wh[2];
  if (fread(wh, 4, 2, f) != 2) { fclose(f); return 0; }
  size_t n = (size_t)wh[0] * wh[1];
  uint8_t *rgba = malloc(n * 4);
  uint32_t *px = malloc(n * 4);
  if (!rgba || !px || fread(rgba, 4, n, f) != n) { fclose(f); free(rgba); free(px); return 0; }
  fclose(f);
  for (size_t i = 0; i < n; i++)
    px[i] = ((uint32_t)rgba[i * 4 + 3] << 24) | ((uint32_t)rgba[i * 4] << 16) | ((uint32_t)rgba[i * 4 + 1] << 8) | rgba[i * 4 + 2];
  free(rgba);
  out->w = (int)wh[0];
  out->h = (int)wh[1];
  out->px = px;
  return 1;
}

/* ---------- partida guardada ---------- */
#define SAVE_DIR "/data/kokicat"
#define SAVE_FILE SAVE_DIR "/save.txt"
int plat_save_read(char *buf, int cap) {
  FILE *f = fopen(SAVE_FILE, "rb");
  if (!f) return -1;
  int n = (int)fread(buf, 1, (size_t)cap, f);
  fclose(f);
  return n;
}
void plat_save_write(const char *buf, int len) {
  mkdir(SAVE_DIR, 0777);
  FILE *f = fopen(SAVE_FILE ".tmp", "wb");
  if (!f) return;
  fwrite(buf, 1, (size_t)len, f);
  fclose(f);
  rename(SAVE_FILE ".tmp", SAVE_FILE);
}

/* ---------- HTTPS al servidor del juego (en otro hilo para no congelar la pantalla) ---------- */
static int http_ctx = -1;
static volatile int net_state = 0;
static char net_url[256], net_req_body[1024], net_resp[16384];

static void net_init(void) {
  if (sceSysmoduleLoadModuleInternal(ORBIS_SYSMODULE_INTERNAL_NET) < 0) return;
  if (sceSysmoduleLoadModuleInternal(ORBIS_SYSMODULE_INTERNAL_HTTP) < 0) return;
  if (sceSysmoduleLoadModuleInternal(ORBIS_SYSMODULE_INTERNAL_SSL) < 0) return;
  sceNetInit();
  int pool = sceNetPoolCreate("kokicat net", 4 * 1024, 0);
  int ssl = sceSslInit(SSL_POOLSIZE);
  if (pool < 0 || ssl < 0) return;
  http_ctx = sceHttpInit(pool, ssl, LIBHTTP_POOLSIZE);
}

static void *net_thread(void *arg) {
  (void)arg;
  int ok = 0, tpl = -1, conn = -1, req = -1;
  int resp_len = 0;
  net_resp[0] = 0;
  if (http_ctx < 0) goto done;
  tpl = sceHttpCreateTemplate(http_ctx, "KokiCat-PS4/1.0", ORBIS_HTTP_VERSION_1_1, 1);
  if (tpl < 0) goto done;
  /* sin respuesta en 10 s se da por perdida (la pantalla muestra "sin conexión") */
  sceHttpSetConnectTimeOut(tpl, 10 * 1000000);
  sceHttpSetResolveTimeOut(tpl, 10 * 1000000);
  sceHttpSetSendTimeOut(tpl, 10 * 1000000);
  conn = sceHttpCreateConnectionWithURL(tpl, net_url, 1);
  if (conn < 0) goto done;
  req = sceHttpCreateRequestWithURL(conn, ORBIS_METHOD_POST, net_url, strlen(net_req_body));
  if (req < 0) goto done;
  sceHttpAddRequestHeader(req, "Content-Type", "application/json", 0);
  sceHttpAddRequestHeader(req, "apikey", SERVER_KEY, 0);
  sceHttpAddRequestHeader(req, "Authorization", "Bearer " SERVER_KEY, 0);
  if (sceHttpSendRequest(req, net_req_body, strlen(net_req_body)) < 0) goto done;
  int32_t status = 0;
  if (sceHttpGetStatusCode(req, &status) < 0) goto done;
  for (;;) {
    int r = sceHttpReadData(req, net_resp + resp_len, sizeof net_resp - 1 - resp_len);
    if (r <= 0) break;
    resp_len += r;
    if (resp_len >= (int)sizeof net_resp - 1) break;
  }
  net_resp[resp_len] = 0;
  ok = status >= 200 && status < 300;
done:
  if (req >= 0) sceHttpDeleteRequest(req);
  if (conn >= 0) sceHttpDeleteConnection(conn);
  if (tpl >= 0) sceHttpDeleteTemplate(tpl);
  __atomic_store_n(&net_state, ok ? 2 : 3, __ATOMIC_RELEASE);
  return NULL;
}

void plat_net_start(const char *fn, const char *json_body) {
  if (__atomic_load_n(&net_state, __ATOMIC_ACQUIRE) == 1) return;
  snprintf(net_url, sizeof net_url, "%s/rest/v1/rpc/%s", SERVER_URL, fn);
  snprintf(net_req_body, sizeof net_req_body, "%s", json_body);
  net_state = 1;
  pthread_t t;
  if (pthread_create(&t, NULL, net_thread, NULL) != 0) { net_state = 3; return; }
  pthread_detach(t);
}
int plat_net_state(void) { return __atomic_load_n(&net_state, __ATOMIC_ACQUIRE); }
const char *plat_net_body(void) { return net_resp; }
void plat_net_reset(void) { net_state = 0; }

int main(void) {
  setvbuf(stdout, NULL, _IONBF, 0);
  for (int x = 0; x < TV_W; x++) src_x[x] = (uint16_t)(x * 2 / 3);
  if (!video_init()) { printf("kokicat: no se pudo abrir la pantalla\n"); for (;;) sceKernelUsleep(1000000); }
  pad_init();
  net_init();
  core_seed((unsigned)sceKernelGetProcessTime());
  core_init();
  for (int frame = 1, buf = 0;; frame++, buf ^= 1) {
    core_frame(pad_buttons());
    present(buf, frame);
  }
}
