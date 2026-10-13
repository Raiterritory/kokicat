// The game core: call core_init() once and core_frame() 60 times a second with the held buttons.
#pragma once
#include <stdint.h>

void core_init(void);
void core_seed(unsigned seed);
void core_frame(uint32_t buttons);
/* FB_W x FB_H pixels, 0xAARRGGBB */
uint32_t *core_fb(void);
