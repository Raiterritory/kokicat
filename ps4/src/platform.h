// What the game core needs from the machine it runs on (PS4, or the WebAssembly test harness).
#pragma once
#include <stdint.h>

/* Internal picture size; the PS4 layer scales it to the TV (1920x1080). */
#define FB_W 1280
#define FB_H 720

/* Controller buttons, as a bit mask */
enum {
  BTN_CROSS = 1 << 0, BTN_CIRCLE = 1 << 1, BTN_SQUARE = 1 << 2, BTN_TRIANGLE = 1 << 3,
  BTN_UP = 1 << 4, BTN_DOWN = 1 << 5, BTN_LEFT = 1 << 6, BTN_RIGHT = 1 << 7,
  BTN_L1 = 1 << 8, BTN_R1 = 1 << 9, BTN_OPTIONS = 1 << 10,
};

typedef struct {
  int w, h;
  const uint32_t *px; /* 0xAARRGGBB */
} Image;

/* Images bundled with the game: "koki", "logo", "coin" */
int plat_load_image(const char *name, Image *out);

/* Save file (small text). Returns length read, or -1. */
int plat_save_read(char *buf, int cap);
void plat_save_write(const char *buf, int len);

/*
 * One HTTPS request at a time to the game server (Supabase RPC): POST /rest/v1/rpc/<fn>
 * with a JSON body. plat_net_state(): 0 idle, 1 busy, 2 done (HTTP 2xx), 3 failed.
 */
void plat_net_start(const char *fn, const char *json_body);
int plat_net_state(void);
const char *plat_net_body(void);
void plat_net_reset(void);
