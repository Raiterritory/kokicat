// Test build of the core for a PC: compiled to WebAssembly and driven by test/run.ts,
// which feeds the images and controller presses and saves screenshots.
#include "../src/platform.h"
#include "../src/core.h"

/* sin libc: el compilador igual usa estas dos para copiar structs */
void *memcpy(void *d, const void *s, unsigned long n) {
  unsigned char *a = d; const unsigned char *b = s;
  while (n--) *a++ = *b++;
  return d;
}
void *memset(void *d, int v, unsigned long n) {
  unsigned char *a = d;
  while (n--) *a++ = (unsigned char)v;
  return d;
}

/* memoria para las imágenes que pasa el script */
static unsigned char heap[8 << 20];
static unsigned heap_top;
__attribute__((export_name("alloc"))) void *alloc(unsigned n) {
  void *p = heap + heap_top;
  heap_top += (n + 15) & ~15u;
  return p;
}

static Image images[3];
static const char *names[3] = {"koki", "logo", "coin"};
__attribute__((export_name("set_image"))) void set_image(int i, int w, int h, const uint32_t *px) {
  images[i] = (Image){w, h, px};
}
static int same(const char *a, const char *b) { while (*a && *a == *b) a++, b++; return *a == *b; }
int plat_load_image(const char *name, Image *out) {
  for (int i = 0; i < 3; i++) if (same(name, names[i])) { *out = images[i]; return 1; }
  return 0;
}

static char save_buf[512];
static int save_len = -1;
int plat_save_read(char *buf, int cap) {
  if (save_len < 0) return -1;
  for (int i = 0; i < save_len && i < cap; i++) buf[i] = save_buf[i];
  return save_len;
}
void plat_save_write(const char *buf, int len) {
  for (int i = 0; i < len && i < 511; i++) save_buf[i] = buf[i];
  save_len = len;
}

/* red falsa: el script decide qué responde el "servidor" */
static int net_state;
static char net_fn[64], net_body[1024], net_reply[4096];
__attribute__((export_name("net_fn"))) const char *get_net_fn(void) { return net_fn; }
__attribute__((export_name("net_req"))) const char *get_net_req(void) { return net_body; }
__attribute__((export_name("net_reply_buf"))) char *net_reply_buf(void) { return net_reply; }
__attribute__((export_name("net_finish"))) void net_finish(int ok) { net_state = ok ? 2 : 3; }
__attribute__((export_name("net_busy"))) int net_busy(void) { return net_state == 1; }
void plat_net_start(const char *fn, const char *json) {
  int i = 0;
  for (; fn[i] && i < 63; i++) net_fn[i] = fn[i];
  net_fn[i] = 0;
  for (i = 0; json[i] && i < 1023; i++) net_body[i] = json[i];
  net_body[i] = 0;
  net_reply[0] = 0;
  net_state = 1;
}
int plat_net_state(void) { return net_state; }
const char *plat_net_body(void) { return net_reply; }
void plat_net_reset(void) { net_state = 0; }

__attribute__((export_name("init"))) void init(unsigned seed) { core_seed(seed); core_init(); }
__attribute__((export_name("frame"))) void frame(unsigned buttons) { core_frame(buttons); }
__attribute__((export_name("fb"))) uint32_t *fb(void) { return core_fb(); }
