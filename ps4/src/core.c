// KokiCat for PS4: the game, its screens and the online ranking, drawn by the CPU into a
// 1280x720 picture. Nothing here depends on the PS4; that lives in main_ps4.c (and
// test/main_wasm.c for testing on a PC).
//
// The physics and sizes are the web version's (src/routes/index.tsx, landscape world of 1066x600)
// scaled by 1.2 so the world fills 1280x720.
#include "core.h"
#include "font.h"
#include "platform.h"

/* ---------- small math (no libc needed) ---------- */
#define PI 3.14159265f
static float fsin(float x) {
  while (x > PI) x -= 2 * PI;
  while (x < -PI) x += 2 * PI;
  float x2 = x * x;
  return x * (1 - x2 / 6 * (1 - x2 / 20 * (1 - x2 / 42 * (1 - x2 / 72))));
}
static float fcos(float x) { return fsin(x + PI / 2); }
static float fabsf_(float x) { return x < 0 ? -x : x; }
static float fminf_(float a, float b) { return a < b ? a : b; }
static float fmaxf_(float a, float b) { return a > b ? a : b; }
static int clampi(int v, int a, int b) { return v < a ? a : v > b ? b : v; }

static unsigned rng_state = 0x1234567;
static float rnd(void) {
  rng_state ^= rng_state << 13; rng_state ^= rng_state >> 17; rng_state ^= rng_state << 5;
  return (rng_state & 0xFFFFFF) / (float)0x1000000;
}

/* ---------- strings ---------- */
static int slen(const char *s) { int n = 0; while (s[n]) n++; return n; }
static void scopy(char *d, const char *s, int cap) { int i = 0; for (; s[i] && i < cap - 1; i++) d[i] = s[i]; d[i] = 0; }
static void sappend(char *d, const char *s, int cap) { scopy(d + slen(d), s, cap - slen(d)); }
static void sappend_int(char *d, int v, int cap) {
  char t[16]; int n = 0, neg = v < 0;
  unsigned u = neg ? (unsigned)-v : (unsigned)v;
  do { t[n++] = (char)('0' + u % 10); u /= 10; } while (u);
  char o[18]; int k = 0;
  if (neg) o[k++] = '-';
  while (n) o[k++] = t[--n];
  o[k] = 0;
  sappend(d, o, cap);
}
static int sfind(const char *h, const char *n) {
  int ln = slen(n);
  for (int i = 0; h[i]; i++) {
    int j = 0;
    while (j < ln && h[i + j] == n[j]) j++;
    if (j == ln) return i;
  }
  return -1;
}
/* JSON string with quotes and backslashes escaped */
static void sappend_json(char *d, const char *s, int cap) {
  sappend(d, "\"", cap);
  for (int i = 0; s[i]; i++) {
    char c[3] = {s[i], 0, 0};
    if (s[i] == '"' || s[i] == '\\') { c[0] = '\\'; c[1] = s[i]; }
    sappend(d, c, cap);
  }
  sappend(d, "\"", cap);
}
/* value of "key" in a flat JSON text (string or number), starting at *pos; moves *pos past it */
static int json_get(const char *js, int *pos, const char *key, char *out, int cap) {
  char pat[48] = "\"";
  sappend(pat, key, sizeof pat);
  sappend(pat, "\"", sizeof pat);
  int i = sfind(js + *pos, pat);
  if (i < 0) return 0;
  i += *pos + slen(pat);
  while (js[i] == ' ' || js[i] == ':') i++;
  int k = 0;
  if (js[i] == '"') {
    i++;
    while (js[i] && js[i] != '"' && k < cap - 1) {
      if (js[i] == '\\' && js[i + 1]) i++;
      out[k++] = js[i++];
    }
  } else {
    while (js[i] && js[i] != ',' && js[i] != '}' && js[i] != ']' && k < cap - 1) out[k++] = js[i++];
  }
  out[k] = 0;
  *pos = i;
  return 1;
}
static int atoi_(const char *s) {
  int v = 0, neg = 0;
  while (*s == ' ' || *s == '"') s++;
  if (*s == '-') { neg = 1; s++; }
  while (*s >= '0' && *s <= '9') v = v * 10 + (*s++ - '0');
  return neg ? -v : v;
}

/* ---------- drawing ---------- */
static uint32_t fb[FB_W * FB_H];
uint32_t *core_fb(void) { return fb; }

static inline uint32_t mix(uint32_t d, uint32_t c, unsigned a) {
  unsigned ia = 255 - a;
  unsigned r = (((c >> 16) & 255) * a + ((d >> 16) & 255) * ia) / 255;
  unsigned g = (((c >> 8) & 255) * a + ((d >> 8) & 255) * ia) / 255;
  unsigned b = ((c & 255) * a + (d & 255) * ia) / 255;
  return 0xFF000000u | (r << 16) | (g << 8) | b;
}
static void rect(int x, int y, int w, int h, uint32_t c) {
  int x0 = clampi(x, 0, FB_W), x1 = clampi(x + w, 0, FB_W);
  int y0 = clampi(y, 0, FB_H), y1 = clampi(y + h, 0, FB_H);
  unsigned a = c >> 24;
  if (!a) return;
  for (int yy = y0; yy < y1; yy++) {
    uint32_t *row = fb + yy * FB_W;
    if (a == 255) for (int xx = x0; xx < x1; xx++) row[xx] = c;
    else for (int xx = x0; xx < x1; xx++) row[xx] = mix(row[xx], c, a);
  }
}
static uint32_t lerp_color(uint32_t a, uint32_t b, float t) {
  unsigned k = (unsigned)(clampi((int)(t * 255), 0, 255));
  return mix(a, b, k);
}
static void hgrad_rect(int x, int y, int w, int h, uint32_t c0, uint32_t mid, uint32_t c1) {
  for (int i = 0; i < w; i++) {
    float t = (float)i / (w - 1);
    uint32_t c = t < 0.4f ? lerp_color(c0, mid, t / 0.4f) : lerp_color(mid, c1, (t - 0.4f) / 0.6f);
    rect(x + i, y, 1, h, c);
  }
}
static void circle(int cx, int cy, int r, uint32_t c) {
  for (int dy = -r; dy <= r; dy++) {
    int dx = 0;
    while ((dx + 1) * (dx + 1) + dy * dy <= r * r) dx++;
    rect(cx - dx, cy + dy, dx * 2 + 1, 1, c);
  }
}
static void round_rect(int x, int y, int w, int h, int r, uint32_t c) {
  if (r * 2 > h) r = h / 2;
  for (int i = 0; i < h; i++) {
    int inset = 0;
    int dy = i < r ? r - i : i >= h - r ? i - (h - r - 1) : 0;
    if (dy) { int dx = 0; while ((dx + 1) * (dx + 1) + dy * dy <= r * r) dx++; inset = r - dx; }
    rect(x + inset, y + i, w - inset * 2, 1, c);
  }
}
/* image centred on (cx, cy), scaled and rotated, with its own alpha */
static void sprite(const Image *im, float cx, float cy, float scale, float rot, unsigned alpha) {
  if (!im->px) return;
  float c = fcos(rot), s = fsin(rot);
  float hw = im->w * scale / 2, hh = im->h * scale / 2;
  float ext = (fabsf_(c) * hw + fabsf_(s) * hh), eyt = (fabsf_(s) * hw + fabsf_(c) * hh);
  int x0 = clampi((int)(cx - ext), 0, FB_W), x1 = clampi((int)(cx + ext + 1), 0, FB_W);
  int y0 = clampi((int)(cy - eyt), 0, FB_H), y1 = clampi((int)(cy + eyt + 1), 0, FB_H);
  float inv = 1.0f / scale;
  for (int y = y0; y < y1; y++) {
    uint32_t *row = fb + y * FB_W;
    for (int x = x0; x < x1; x++) {
      float dx = x - cx, dy = y - cy;
      int u = (int)((dx * c + dy * s) * inv + im->w / 2.0f);
      int v = (int)((-dx * s + dy * c) * inv + im->h / 2.0f);
      if (u < 0 || v < 0 || u >= im->w || v >= im->h) continue;
      uint32_t p = im->px[v * im->w + u];
      unsigned a = ((p >> 24) * alpha) / 255;
      if (a) row[x] = a == 255 ? p | 0xFF000000u : mix(row[x], p, a);
    }
  }
}

/* text: size = pixels per font dot */
enum { LEFT, CENTER, RIGHT };
static int text_width(const char *s, int size) {
  int n = slen(s);
  return n ? n * 6 * size - size : 0;
}
static void text_raw(int x, int y, int size, uint32_t color, const char *s) {
  for (int i = 0; s[i]; i++) {
    const uint8_t *g = font_glyph(s[i]);
    if (g)
      for (int r = 0; r < 7; r++)
        for (int c = 0; c < 5; c++)
          if (g[r] & (0x10 >> c)) rect(x + c * size, y + r * size, size, size, color);
    x += 6 * size;
  }
}
/* with a dark outline so it reads on any background */
static void text(int x, int y, int size, uint32_t color, int align, const char *s) {
  int w = text_width(s, size);
  if (align == CENTER) x -= w / 2;
  else if (align == RIGHT) x -= w;
  int o = size / 2 > 1 ? size / 2 : 2;
  for (int dy = -o; dy <= o; dy += o)
    for (int dx = -o; dx <= o; dx += o)
      if (dx || dy) text_raw(x + dx, y + dy, size, 0xFF111111, s);
  text_raw(x, y, size, color, s);
}

/* ---------- game constants (web value x 1.2) ---------- */
#define GRAVITY 0.6f
#define JUMP (-10.08f)
#define MAX_FALL 14.4f
#define PIPE_W 84
#define GAP 246
#define PIPE_SPEED 3.0f
#define PIPE_INTERVAL 112
#define KOKI_SIZE 77
#define GROUND_H 48
#define COIN_SIZE 43
#define KOKI_X 540
#define HARD_START 3.72f
#define HARD_PER_POINT 0.066f
#define HARD_MAX 8.4f

typedef struct { float x; int top; int passed; } Pipe;
typedef struct { float x, y, bob; int taken; } Coin;
typedef struct { float x, y, vx, vy; int life; uint32_t c; } Spark;
typedef struct { float x, y; } Pt;

enum Screen { S_TITLE, S_READY, S_PLAY, S_OVER, S_RANK, S_LOGIN };
enum { MODE_NORMAL, MODE_HARD };

static struct {
  int screen, mode, frame;
  float y, vy, rot, flap, speed, scroll, spawn_dist;
  int score, run_coins;
  Pipe pipes[16]; int npipes;
  Coin coins[16]; int ncoins;
  Spark sparks[96]; int nsparks;
  Pt trail[200]; int ntrail;
  int menu_sel, over_frames, new_record;
} G;

static Image img_koki, img_logo, img_coin;

/* ---------- save data + account ---------- */
static struct {
  int best, best_hard, coins;
  char id[48], secret[48], nick[32];
} S;

static void save(void) {
  char b[400] = "best=";
  sappend_int(b, S.best, sizeof b); sappend(b, "\nhard=", sizeof b);
  sappend_int(b, S.best_hard, sizeof b); sappend(b, "\ncoins=", sizeof b);
  sappend_int(b, S.coins, sizeof b); sappend(b, "\nid=", sizeof b);
  sappend(b, S.id, sizeof b); sappend(b, "\nsecret=", sizeof b);
  sappend(b, S.secret, sizeof b); sappend(b, "\nnick=", sizeof b);
  sappend(b, S.nick, sizeof b); sappend(b, "\n", sizeof b);
  plat_save_write(b, slen(b));
}
static void load_line(const char *b, const char *key, char *out, int cap) {
  char pat[24]; scopy(pat, key, sizeof pat); sappend(pat, "=", sizeof pat);
  int i = sfind(b, pat);
  out[0] = 0;
  if (i < 0) return;
  i += slen(pat);
  int k = 0;
  while (b[i] && b[i] != '\n' && k < cap - 1) out[k++] = b[i++];
  out[k] = 0;
}
static void load(void) {
  char b[400];
  int n = plat_save_read(b, sizeof b - 1);
  if (n <= 0) return;
  b[n] = 0;
  char t[48];
  load_line(b, "best", t, sizeof t); S.best = atoi_(t);
  load_line(b, "hard", t, sizeof t); S.best_hard = atoi_(t);
  load_line(b, "coins", t, sizeof t); S.coins = atoi_(t);
  load_line(b, "id", S.id, sizeof S.id);
  load_line(b, "secret", S.secret, sizeof S.secret);
  load_line(b, "nick", S.nick, sizeof S.nick);
}
static int logged_in(void) { return S.id[0] && S.secret[0]; }

/* ---------- network (one request at a time, in order) ---------- */
enum { NET_NONE, NET_LOGIN, NET_SUBMIT, NET_BOARD };
static int net_kind = NET_NONE, submit_pending = 0;
static char net_msg[64];

static void submit_scores(void) {
  if (!logged_in()) return;
  if (net_kind != NET_NONE) { submit_pending = 1; return; }
  char b[256] = "{\"p_id\":";
  sappend_json(b, S.id, sizeof b); sappend(b, ",\"p_secret\":", sizeof b);
  sappend_json(b, S.secret, sizeof b); sappend(b, ",\"p_normal\":", sizeof b);
  sappend_int(b, S.best, sizeof b); sappend(b, ",\"p_hard\":", sizeof b);
  sappend_int(b, S.best_hard, sizeof b); sappend(b, "}", sizeof b);
  /* submit_score solo sube los récords (nunca baja lo que hiciste en el teléfono) */
  plat_net_start("submit_score", b);
  net_kind = NET_SUBMIT;
  submit_pending = 0;
}

/* ranking */
typedef struct { char nick[32]; int score; } Row;
static Row board[10];
static int board_n = 0, board_mode = MODE_NORMAL, board_state = 0; /* 0 cargando, 1 listo, 2 error */

static void load_board(void) {
  board_state = 0; board_n = 0;
  if (net_kind != NET_NONE) return; /* se pide cuando termine lo anterior */
  char b[96] = "{\"p_mode\":";
  sappend(b, board_mode == MODE_HARD ? "\"hard\"" : "\"normal\"", sizeof b);
  sappend(b, ",\"p_limit\":10}", sizeof b);
  plat_net_start("global_leaderboard", b);
  net_kind = NET_BOARD;
}

/* login with an on-screen keyboard */
static const char *KEYS[2][4] = {
  {"1234567890", "qwertyuiop", "asdfghjkl_", "zxcvbnm.-@"},
  {"1234567890", "QWERTYUIOP", "ASDFGHJKL_", "ZXCVBNM.-@"},
};
static struct { int step, row, col, caps; char nick[32], pass[48]; } L;

static void start_login(void) {
  L.step = 0; L.row = 1; L.col = 0; L.caps = 0;
  L.nick[0] = L.pass[0] = 0;
  net_msg[0] = 0;
  G.screen = S_LOGIN;
}
static void send_login(void) {
  if (net_kind != NET_NONE) return;
  char b[200] = "{\"p_nick\":";
  sappend_json(b, L.nick, sizeof b); sappend(b, ",\"p_password\":", sizeof b);
  sappend_json(b, L.pass, sizeof b); sappend(b, "}", sizeof b);
  plat_net_start("login_player", b);
  net_kind = NET_LOGIN;
  L.step = 2;
  scopy(net_msg, "CONECTANDO...", sizeof net_msg);
}

static void net_update(void) {
  if (net_kind == NET_NONE) {
    if (submit_pending) submit_scores();
    else if (G.screen == S_RANK && board_state == 0) load_board();
    return;
  }
  int st = plat_net_state();
  if (st < 2) return;
  const char *body = plat_net_body();
  if (net_kind == NET_LOGIN) {
    char id[48] = "", secret[48] = "", nick[32] = "", best[16] = "";
    int p = 0;
    if (st == 2 && json_get(body, &p, "id", id, sizeof id)) {
      p = 0; json_get(body, &p, "secret", secret, sizeof secret);
      p = 0; json_get(body, &p, "nickname", nick, sizeof nick);
      scopy(S.id, id, sizeof S.id); scopy(S.secret, secret, sizeof S.secret); scopy(S.nick, nick, sizeof S.nick);
      /* el récord guardado en tu perfil (del teléfono) también cuenta aquí */
      p = 0; if (json_get(body, &p, "koki-best", best, sizeof best)) S.best = (int)fmaxf_((float)S.best, (float)atoi_(best));
      p = 0; if (json_get(body, &p, "koki-best-hard", best, sizeof best)) S.best_hard = (int)fmaxf_((float)S.best_hard, (float)atoi_(best));
      save();
      submit_pending = 1;
      G.screen = S_TITLE;
      net_msg[0] = 0;
    } else {
      if (sfind(body, "locked") >= 0) scopy(net_msg, "DEMASIADOS INTENTOS. ESPERA 10 MIN", sizeof net_msg);
      else if (st == 2 || sfind(body, "invalid_login") >= 0) scopy(net_msg, "APODO O CLAVE NO COINCIDEN", sizeof net_msg);
      else scopy(net_msg, "SIN CONEXION, INTENTA DE NUEVO", sizeof net_msg);
      L.step = 1;
    }
  } else if (net_kind == NET_BOARD) {
    if (st == 2) {
      int p = 0;
      board_n = 0;
      char nick[32], sc[16];
      while (board_n < 10 && json_get(body, &p, "nickname", nick, sizeof nick) && json_get(body, &p, "score", sc, sizeof sc)) {
        scopy(board[board_n].nick, nick, sizeof board[board_n].nick);
        board[board_n].score = atoi_(sc);
        board_n++;
      }
      board_state = 1;
    } else board_state = 2;
  }
  net_kind = NET_NONE;
  plat_net_reset();
}

/* ---------- game ---------- */
static void reset_run(void) {
  G.y = FB_H / 2.0f; G.vy = 0; G.rot = 0; G.flap = 0;
  G.score = 0; G.run_coins = 0;
  G.npipes = G.ncoins = G.nsparks = 0; G.ntrail = 0;
  G.speed = PIPE_SPEED;
  G.spawn_dist = PIPE_INTERVAL * PIPE_SPEED; /* primera tubería apenas se parte */
}
static void sparks(float x, float y, int n, uint32_t c) {
  for (int i = 0; i < n && G.nsparks < 96; i++) {
    float a = rnd() * 2 * PI, v = 2 + rnd() * 4;
    G.sparks[G.nsparks++] = (Spark){x, y, fcos(a) * v, fsin(a) * v, 30 + (int)(rnd() * 20), c};
  }
}
static void jump(void) {
  G.vy = JUMP; G.rot = -0.45f; G.flap = 1;
  sparks(KOKI_X - 20, G.y + 10, 4, 0xC0FFFFFF);
}
static void end_run(void) {
  G.screen = S_OVER;
  G.over_frames = 0;
  S.coins += G.run_coins;
  int *best = G.mode == MODE_HARD ? &S.best_hard : &S.best;
  G.new_record = G.score > *best;
  if (G.new_record) *best = G.score;
  save();
  if (G.new_record) submit_scores();
}

static void update_play(void) {
  G.speed = G.mode == MODE_HARD ? fminf_(HARD_MAX, HARD_START + G.score * HARD_PER_POINT) : PIPE_SPEED;
  G.vy += GRAVITY;
  if (G.vy > MAX_FALL) G.vy = MAX_FALL;
  G.y += G.vy;
  float target = G.vy < 0 ? -0.45f : fminf_(1.4f, G.vy * 0.12f);
  G.rot += (target - G.rot) * (G.vy < 0 ? 0.5f : 0.12f);

  G.spawn_dist += G.speed;
  if (G.spawn_dist >= PIPE_INTERVAL * PIPE_SPEED && G.npipes < 16) {
    G.spawn_dist = 0;
    int top = 72 + (int)(rnd() * (FB_H - GAP - 216));
    G.pipes[G.npipes++] = (Pipe){FB_W, top, 0};
    if (rnd() < 0.55f && G.ncoins < 16)
      G.coins[G.ncoins++] = (Coin){FB_W + PIPE_W / 2 + 54, top + GAP / 2 + (rnd() - 0.5f) * (GAP - 72), rnd() * 6.28f, 0};
  }
  int k = 0;
  for (int i = 0; i < G.npipes; i++) {
    G.pipes[i].x -= G.speed;
    if (G.pipes[i].x + PIPE_W > 0) G.pipes[k++] = G.pipes[i];
  }
  G.npipes = k;
  k = 0;
  for (int i = 0; i < G.ncoins; i++) {
    G.coins[i].x -= G.speed; G.coins[i].bob += 0.1f;
    if (G.coins[i].x + COIN_SIZE > 0 && !G.coins[i].taken) G.coins[k++] = G.coins[i];
  }
  G.ncoins = k;

  float r = KOKI_SIZE / 2.0f - 7;
  if (G.y + r > FB_H - GROUND_H || G.y - r < 0) { end_run(); return; }
  for (int i = 0; i < G.npipes; i++) {
    Pipe *p = &G.pipes[i];
    if (KOKI_X + r > p->x && KOKI_X - r < p->x + PIPE_W && (G.y - r < p->top || G.y + r > p->top + GAP)) { end_run(); return; }
    if (!p->passed && p->x + PIPE_W < KOKI_X) {
      p->passed = 1;
      G.score++;
      sparks(KOKI_X, G.y, 10, 0xFFFFE066);
    }
  }
  for (int i = 0; i < G.ncoins; i++) {
    Coin *c = &G.coins[i];
    float dx = c->x - KOKI_X, dy = c->y - G.y, rr = r + COIN_SIZE / 2.0f;
    if (!c->taken && dx * dx + dy * dy < rr * rr) {
      c->taken = 1;
      G.run_coins++;
      sparks(c->x, c->y, 8, 0xFFFF8FB8);
    }
  }
}

/* ---------- scene drawing ---------- */
static void skyline(float offset, int base_y, uint32_t color, int spacing, int max_h, int min_h, int seed) {
  int count = FB_W / spacing + 3;
  float loop = (float)spacing * count;
  float off = offset - (int)(offset / loop) * loop;
  for (int i = 0; i < count; i++) {
    float r = fsin((i + seed) * 12.9898f) * 43758.5453f;
    float frac = r - (int)r;
    if (frac < 0) frac += 1;
    int h = min_h + (int)(frac * (max_h - min_h));
    int bx = (int)(i * spacing - off);
    rect(bx, base_y - h, spacing - 10, FB_H - GROUND_H - (base_y - h), color);
  }
}
static void draw_world(int moving) {
  /* cielo de atardecer, sol y ciudad en dos capas (como en el juego del teléfono) */
  int horizon = FB_H;
  for (int y = 0; y < horizon; y++) {
    float t = (float)y / horizon;
    uint32_t c = t < 0.5f ? lerp_color(0xFF1A2947, 0xFF4A5F8A, t * 2) : lerp_color(0xFF4A5F8A, 0xFFF4A06A, (t - 0.5f) * 2);
    rect(0, y, FB_W, 1, c);
  }
  circle(FB_W - 96, 168, 66, 0x73FFD28C);
  skyline(G.frame * 0.3f, FB_H - GROUND_H - 108, 0xFF2A3255, 84, 132, 66, 1);
  skyline(G.frame * 0.9f, FB_H - GROUND_H - 36, 0xFF141A33, 108, 120, 48, 7);
  (void)moving;
}
static void draw_pipe(int x, int y, int h, int is_top) {
  if (h <= 0) return;
  hgrad_rect(x, y, PIPE_W, h, 0xFF5A6478, 0xFF8B95AD, 0xFF3D4658);
  rect(x, y, 3, h, 0xFF1F2635); rect(x + PIPE_W - 3, y, 3, h, 0xFF1F2635);
  int cap = 29, cy = is_top ? y + h - cap : y;
  hgrad_rect(x - 5, cy, PIPE_W + 10, cap, 0xFF5A6478, 0xFF8B95AD, 0xFF3D4658);
  rect(x - 5, cy, PIPE_W + 10, 3, 0xFF1F2635); rect(x - 5, cy + cap - 3, PIPE_W + 10, 3, 0xFF1F2635);
  rect(x - 5, cy, 3, cap, 0xFF1F2635); rect(x + PIPE_W + 2, cy, 3, cap, 0xFF1F2635);
}
static void draw_trail(void) {
  /* estela arcoíris: se afina y se desvanece hacia la cola */
  static const uint32_t bands[6] = {0xFF3B3B, 0xFF9A2D, 0xFFE62D, 0x3DDC4A, 0x2D9BFF, 0xA44BFF};
  int n = G.ntrail;
  for (int i = 1; i < n; i++) {
    float t = (float)i / (n - 1);
    float w = 0.3f + 0.7f * t;
    unsigned a = (unsigned)(255 * (t < 0.35f ? t / 0.35f * 0.55f : 0.55f + (t - 0.35f) / 0.65f * 0.45f));
    float bh = 7 * w;
    float top = G.trail[i].y - bh * 3;
    int x0 = (int)G.trail[i - 1].x, x1 = (int)G.trail[i].x + 1;
    for (int b = 0; b < 6; b++) rect(x0, (int)(top + b * bh), x1 - x0 + 1, (int)(bh + 1), (a << 24) | bands[b]);
  }
}
static void draw_ground(void) {
  rect(0, FB_H - GROUND_H, FB_W, GROUND_H, 0xFF2A2A30);
  int off = (int)G.scroll % 36;
  for (int x = 0; x < FB_W + 36; x += 36) rect(x - off, FB_H - GROUND_H + 22, 19, 5, 0xFFF5D547);
}
static void draw_koki(void) {
  float idle = fsin(G.frame * 0.35f) * 0.06f;
  float sy = 1 + idle - G.flap * 0.18f;
  (void)sy;
  float scale = (float)KOKI_SIZE * 1.25f / img_koki.h;
  sprite(&img_koki, KOKI_X, G.y, scale, G.rot - G.flap * 0.35f, 255);
}
static void draw_play_scene(void) {
  draw_world(1);
  for (int i = 0; i < G.npipes; i++) {
    Pipe *p = &G.pipes[i];
    draw_pipe((int)p->x, 0, p->top, 1);
    draw_pipe((int)p->x, p->top + GAP, FB_H - GROUND_H - (p->top + GAP), 0);
  }
  for (int i = 0; i < G.ncoins; i++) {
    Coin *c = &G.coins[i];
    sprite(&img_coin, c->x, c->y + fsin(c->bob) * 5, (float)COIN_SIZE / img_coin.w, 0, 255);
  }
  draw_trail();
  draw_ground();
  draw_koki();
  for (int i = 0; i < G.nsparks; i++) {
    Spark *s = &G.sparks[i];
    unsigned a = (unsigned)clampi(s->life * 8, 0, 255);
    rect((int)s->x - 3, (int)s->y - 3, 6, 6, (a << 24) | (s->c & 0xFFFFFF));
  }
}
static void update_common(void) {
  G.frame++;
  G.scroll += G.speed;
  if (G.flap > 0) G.flap = fmaxf_(0, G.flap - 0.06f);
  int k = 0;
  for (int i = 0; i < G.nsparks; i++) {
    Spark *s = &G.sparks[i];
    s->x += s->vx - G.speed * 0.5f; s->y += s->vy; s->vy += 0.15f; s->life--;
    if (s->life > 0) G.sparks[k++] = *s;
  }
  G.nsparks = k;
  for (int i = 0; i < G.ntrail; i++) G.trail[i].x -= G.speed;
  if (G.ntrail == 200) { for (int i = 1; i < 200; i++) G.trail[i - 1] = G.trail[i]; G.ntrail--; }
  G.trail[G.ntrail++] = (Pt){KOKI_X - 30, G.y};
  k = 0;
  for (int i = 0; i < G.ntrail; i++) if (G.trail[i].x > -30) G.trail[k++] = G.trail[i];
  G.ntrail = k;
}

/* ---------- UI pieces ---------- */
static void button(int cx, int y, int w, const char *label, uint32_t top, uint32_t bottom, uint32_t shadow, int selected) {
  int h = 66, x = cx - w / 2;
  if (selected) round_rect(x - 9, y - 9, w + 18, h + 22, 42, 0xFFFFD60A);
  round_rect(x, y + 7, w, h, 33, shadow);
  for (int i = 0; i < h; i++) {
    uint32_t c = lerp_color(top, bottom, (float)i / h);
    int r = 33, dy = i < r ? r - i : i >= h - r ? i - (h - r - 1) : 0, inset = 0;
    if (dy) { int dx = 0; while ((dx + 1) * (dx + 1) + dy * dy <= r * r) dx++; inset = r - dx; }
    rect(x + inset, y + i, w - inset * 2, 1, c);
  }
  text(cx, y + 19, 4, 0xFFFFFFFF, CENTER, label);
}
static void card(int x, int y, int w, int h) {
  round_rect(x, y + 6, w, h, 28, 0x66000000);
  round_rect(x, y, w, h, 28, 0xF2F5F7FA);
}
static void hint(const char *s) { text(FB_W / 2, FB_H - 34, 3, 0xFFFFFFFF, CENTER, s); }

/* ---------- screens ---------- */
static void title_screen(uint32_t press) {
  const int n = 4;
  if (press & BTN_UP) G.menu_sel = (G.menu_sel + n - 1) % n;
  if (press & BTN_DOWN) G.menu_sel = (G.menu_sel + 1) % n;
  if (press & (BTN_CROSS | BTN_OPTIONS)) {
    if (G.menu_sel <= 1) { G.mode = G.menu_sel == 0 ? MODE_NORMAL : MODE_HARD; reset_run(); G.screen = S_READY; }
    else if (G.menu_sel == 2) { board_mode = MODE_NORMAL; board_state = 0; G.screen = S_RANK; }
    else if (logged_in()) { S.id[0] = S.secret[0] = S.nick[0] = 0; save(); }
    else start_login();
  }
  G.y = FB_H / 2.0f + fsin(G.frame * 0.08f) * 14;
  draw_world(1);
  draw_ground();
  /* logo flotando a la izquierda (como en el menú del teléfono) */
  float bob = fsin(G.frame * 0.044f);
  sprite(&img_logo, 330, 330 + bob * 9, 520.0f / img_logo.h, bob * 0.026f, 255);
  int cx = 900, y = 150;
  char rec[48] = "RECORD: ";
  sappend_int(rec, S.best, sizeof rec); sappend(rec, "   DIFICIL: ", sizeof rec); sappend_int(rec, S.best_hard, sizeof rec);
  button(cx, y, 460, "JUGAR", 0xFFF87171, 0xFFDC2626, 0xFF7F1D1D, G.menu_sel == 0);
  button(cx, y + 100, 460, "DIFICIL", 0xFFFB923C, 0xFFEA580C, 0xFF7C2D12, G.menu_sel == 1);
  button(cx, y + 200, 460, "RANKING", 0xFFFCD34D, 0xFFF59E0B, 0xFF92400E, G.menu_sel == 2);
  button(cx, y + 300, 460, logged_in() ? "CERRAR SESION" : "INICIAR SESION", 0xFF38BDF8, 0xFF2563EB, 0xFF1E3A8A, G.menu_sel == 3);
  text(cx, y + 400, 3, 0xFFFFFFFF, CENTER, rec);
  char who[64];
  if (logged_in()) { scopy(who, "EN LINEA: ", sizeof who); sappend(who, S.nick, sizeof who); }
  else scopy(who, "INICIA SESION PARA EL RANKING", sizeof who);
  text(cx, y + 440, 3, logged_in() ? 0xFF86EFAC : 0xFFFDE68A, CENTER, who);
}

static void ready_screen(uint32_t press) {
  if (press & BTN_CIRCLE) { G.screen = S_TITLE; return; }
  if (press & (BTN_CROSS | BTN_OPTIONS)) { G.screen = S_PLAY; jump(); }
  G.y = FB_H / 2.0f + fsin(G.frame * 0.08f) * 12;
  G.rot = fsin(G.frame * 0.08f) * 0.1f;
  draw_play_scene();
  text(FB_W / 2, 150, 8, 0xFFFFFFFF, CENTER, G.mode == MODE_HARD ? "DIFICIL" : "LISTO?");
  text(FB_W / 2, 250, 4, 0xFFFFFFFF, CENTER, "X PARA SALTAR");
  hint("O VOLVER");
}

static void play_screen(uint32_t press) {
  if (press & (BTN_CROSS | BTN_OPTIONS | BTN_R1)) jump();
  update_play();
  draw_play_scene();
  char sc[16] = "";
  sappend_int(sc, G.score, sizeof sc);
  text(FB_W / 2, 40, 10, 0xFFFFFFFF, CENTER, sc);
  char coins[24] = "+";
  sappend_int(coins, G.run_coins, sizeof coins);
  text(40, 40, 4, 0xFFFF8FB8, LEFT, coins);
}

static void over_screen(uint32_t press) {
  G.over_frames++;
  if (G.over_frames > 20) {
    if (press & (BTN_CROSS | BTN_OPTIONS)) { reset_run(); G.screen = S_READY; return; }
    if (press & BTN_CIRCLE) { G.screen = S_TITLE; return; }
  }
  draw_play_scene();
  rect(0, 0, FB_W, FB_H, 0x55000000);
  int w = 560, h = 360, x = (FB_W - w) / 2, y = 150;
  card(x, y, w, h);
  text_raw(FB_W / 2 - text_width("GAME OVER!", 7) / 2, y + 30, 7, 0xFFDC2626, "GAME OVER!");
  char a[24] = "", b[24] = "", c[24] = "+";
  sappend_int(a, G.score, sizeof a);
  sappend_int(b, G.mode == MODE_HARD ? S.best_hard : S.best, sizeof b);
  sappend_int(c, G.run_coins, sizeof c);
  const char *labels[3] = {"SCORE", "MEJOR", "PASTELITOS"};
  const char *vals[3] = {a, b, c};
  uint32_t cols[3] = {0xFF334155, 0xFFB45309, 0xFFBE185D};
  for (int i = 0; i < 3; i++) {
    int bx = x + 30 + i * 170;
    round_rect(bx, y + 110, 160, 110, 20, i == 1 ? 0xFFFEF3C7 : i == 2 ? 0xFFFCE7F3 : 0xFFE2E8F0);
    text_raw(bx + 80 - text_width(labels[i], 2) / 2, y + 125, 2, cols[i], labels[i]);
    text_raw(bx + 80 - text_width(vals[i], 6) / 2, y + 160, 6, cols[i], vals[i]);
  }
  if (G.new_record) text_raw(FB_W / 2 - text_width("NUEVO RECORD!", 4) / 2, y + 245, 4, 0xFFB45309, "NUEVO RECORD!");
  text_raw(FB_W / 2 - text_width("X REINTENTAR    O MENU", 3) / 2, y + 305, 3, 0xFF475569, "X REINTENTAR    O MENU");
}

static void rank_screen(uint32_t press) {
  if (press & BTN_CIRCLE) { G.screen = S_TITLE; return; }
  if (press & (BTN_LEFT | BTN_RIGHT | BTN_L1 | BTN_R1)) {
    board_mode = board_mode == MODE_NORMAL ? MODE_HARD : MODE_NORMAL;
    board_state = 0;
  }
  if (press & BTN_TRIANGLE) board_state = 0;
  draw_world(1);
  draw_ground();
  int w = 760, x = (FB_W - w) / 2, y = 50;
  card(x, y, w, 590);
  text_raw(FB_W / 2 - text_width("RANKING", 6) / 2, y + 26, 6, 0xFFB45309, "RANKING");
  const char *tab = board_mode == MODE_HARD ? "< DIFICIL >" : "< NORMAL >";
  text_raw(FB_W / 2 - text_width(tab, 3) / 2, y + 90, 3, 0xFF475569, tab);
  if (board_state == 0) text_raw(FB_W / 2 - text_width("CARGANDO...", 4) / 2, y + 260, 4, 0xFF64748B, "CARGANDO...");
  else if (board_state == 2) text_raw(FB_W / 2 - text_width("SIN CONEXION", 4) / 2, y + 260, 4, 0xFFDC2626, "SIN CONEXION");
  else {
    for (int i = 0; i < board_n; i++) {
      int ry = y + 135 + i * 40;
      int me = logged_in() && sfind(board[i].nick, S.nick) == 0 && slen(board[i].nick) == slen(S.nick);
      if (me) round_rect(x + 30, ry - 8, w - 60, 38, 12, 0xFFFEF3C7);
      char pos[8] = "";
      sappend_int(pos, i + 1, sizeof pos);
      uint32_t col = i == 0 ? 0xFFD97706 : i == 1 ? 0xFF64748B : i == 2 ? 0xFFB45309 : 0xFF334155;
      text_raw(x + 60, ry, 3, col, pos);
      text_raw(x + 130, ry, 3, 0xFF1E293B, board[i].nick);
      char sc[16] = "";
      sappend_int(sc, board[i].score, sizeof sc);
      text_raw(x + w - 60 - text_width(sc, 3), ry, 3, 0xFF1E293B, sc);
    }
    if (!board_n) text_raw(FB_W / 2 - text_width("TODAVIA NO HAY PUNTAJES", 3) / 2, y + 260, 3, 0xFF64748B, "TODAVIA NO HAY PUNTAJES");
  }
  hint("< > CAMBIAR MODO    TRIANGULO ACTUALIZAR    O VOLVER");
}

static void login_screen(uint32_t press) {
  char *field = L.step == 0 ? L.nick : L.pass;
  int cap = L.step == 0 ? (int)sizeof L.nick : (int)sizeof L.pass;
  if (L.step < 2) {
    if (press & BTN_UP) L.row = (L.row + 4) % 5;
    if (press & BTN_DOWN) L.row = (L.row + 1) % 5;
    if (press & BTN_LEFT) L.col = (L.col + 9) % 10;
    if (press & BTN_RIGHT) L.col = (L.col + 1) % 10;
    if (press & BTN_TRIANGLE) L.caps ^= 1;
    if ((press & BTN_SQUARE) && slen(field)) field[slen(field) - 1] = 0;
    if (press & BTN_CIRCLE) {
      if (L.step == 1) { L.step = 0; L.pass[0] = 0; }
      else { G.screen = S_TITLE; return; }
    }
    int done = (press & BTN_OPTIONS) != 0;
    if (press & BTN_CROSS) {
      if (L.row < 4) {
        char ch[2] = {KEYS[L.caps][L.row][L.col], 0};
        if (slen(field) < cap - 1) sappend(field, ch, cap);
      } else {
        int k = L.col * 3 / 10; /* fila de abajo: MAYUS | BORRAR | LISTO */
        if (k == 0) L.caps ^= 1;
        else if (k == 1) { if (slen(field)) field[slen(field) - 1] = 0; }
        else done = 1;
      }
    }
    if (done && slen(field)) {
      if (L.step == 0) { L.step = 1; net_msg[0] = 0; }
      else send_login();
    }
  }
  draw_world(1);
  draw_ground();
  int w = 900, x = (FB_W - w) / 2, y = 30;
  card(x, y, w, 640);
  const char *title = L.step == 0 ? "TU APODO" : "TU CONTRASENA";
  text_raw(FB_W / 2 - text_width(title, 5) / 2, y + 24, 5, 0xFF1D4ED8, title);
  /* lo escrito (la contraseña se ve como asteriscos) */
  round_rect(x + 60, y + 80, w - 120, 64, 16, 0xFFE2E8F0);
  char shown[64] = "";
  if (L.step == 0) scopy(shown, L.nick, sizeof shown);
  else for (int i = 0; L.pass[i] && i < 40; i++) sappend(shown, "*", sizeof shown);
  if ((G.frame / 30) % 2 == 0 && L.step < 2) sappend(shown, "_", sizeof shown);
  text_raw(x + 80, y + 96, 4, 0xFF0F172A, shown);
  if (L.step == 1) {
    char who[48] = "APODO: ";
    sappend(who, L.nick, sizeof who);
    text_raw(x + 60, y + 156, 3, 0xFF64748B, who);
  }
  /* teclado */
  int kx = x + 75, ky = y + 200, kw = 66, kh = 62;
  for (int r = 0; r < 4; r++)
    for (int c = 0; c < 10; c++) {
      int sel = L.step < 2 && L.row == r && L.col == c;
      int bx = kx + c * (kw + 10), by = ky + r * (kh + 10);
      if (sel) round_rect(bx - 5, by - 5, kw + 10, kh + 10, 14, 0xFFFFD60A);
      round_rect(bx, by, kw, kh, 12, sel ? 0xFF2563EB : 0xFF334155);
      char ch[2] = {KEYS[L.caps][r][c], 0};
      text_raw(bx + kw / 2 - text_width(ch, 4) / 2, by + 17, 4, 0xFFFFFFFF, ch);
    }
  const char *bottom[3] = {L.caps ? "minusculas" : "MAYUSCULAS", "BORRAR", "LISTO"};
  for (int k = 0; k < 3; k++) {
    int sel = L.step < 2 && L.row == 4 && L.col * 3 / 10 == k;
    int bw = 236, bx = kx + k * (bw + 12), by = ky + 4 * (kh + 10);
    if (sel) round_rect(bx - 5, by - 5, bw + 10, kh + 10, 14, 0xFFFFD60A);
    round_rect(bx, by, bw, kh, 12, k == 2 ? 0xFF16A34A : sel ? 0xFF2563EB : 0xFF334155);
    text_raw(bx + bw / 2 - text_width(bottom[k], 3) / 2, by + 20, 3, 0xFFFFFFFF, bottom[k]);
  }
  if (net_msg[0]) text_raw(FB_W / 2 - text_width(net_msg, 3) / 2, y + 590, 3, L.step == 2 ? 0xFF2563EB : 0xFFDC2626, net_msg);
  else text_raw(FB_W / 2 - text_width("X ESCRIBIR  CUADRADO BORRAR  TRIANGULO MAYUS  OPTIONS LISTO", 2) / 2, y + 596, 2, 0xFF64748B,
                "X ESCRIBIR  CUADRADO BORRAR  TRIANGULO MAYUS  OPTIONS LISTO");
}

/* ---------- entry points ---------- */
static uint32_t prev_buttons;

void core_init(void) {
  plat_load_image("koki", &img_koki);
  plat_load_image("logo", &img_logo);
  plat_load_image("coin", &img_coin);
  load();
  reset_run();
  G.screen = S_TITLE;
  if (logged_in()) submit_pending = 1; /* sube los récords guardados al partir */
}

void core_seed(unsigned seed) { rng_state = seed ? seed : 1; }

void core_frame(uint32_t buttons) {
  uint32_t press = buttons & ~prev_buttons;
  prev_buttons = buttons;
  update_common();
  net_update();
  switch (G.screen) {
    case S_TITLE: title_screen(press); break;
    case S_READY: ready_screen(press); break;
    case S_PLAY: play_screen(press); break;
    case S_OVER: over_screen(press); break;
    case S_RANK: rank_screen(press); break;
    case S_LOGIN: login_screen(press); break;
  }
}
