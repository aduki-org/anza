content = """/**
 * tokens/primitives/linear.css
 *
 * Linear gradient primitives following short naming patterns - CORAL/TEAL BASED.
 */

:root {
  /* Action gradients - CORAL/TEAL */
  --linear-action: linear-gradient(135deg, #FF6B6B, #4ECDC4);
  --linear-action-hover: linear-gradient(135deg, #ff8585, #6be2da);
  --linear-button: linear-gradient(#D15555, #FF6B6B);
  --linear-button-hover: linear-gradient(#FF6B6B, #ff8585);
  
  /* Status gradients */
  --linear-success: linear-gradient(#10b981, #0d9968);
  --linear-error: linear-gradient(103.53deg, #fa6436 -6.72%, #ec4b19 109.77%);
  --linear-warn: linear-gradient(103.53deg, #fa6436 -6.72%, #ec4b19 109.77%);
  --linear-info: linear-gradient(#1a7dff, #0d5cd9);
  
  /* Brand gradients - CORAL/TEAL */
  --linear-brand: linear-gradient(135deg, #FF6B6B 0%, #4ECDC4 100%);
  --linear-brand-alt: linear-gradient(0deg, #4ECDC4 0%, #FF6B6B 100%);
  --linear-brand-light: linear-gradient(90deg, #FF6B6B 0%, #4ECDC4 100%);
  --linear-brand-complex: linear-gradient(
    135deg,
    #FF6B6B 0%,
    #ff8585 20%,
    #4ECDC4 80%,
    #2bb2a9 100%
  );
  
  /* Special gradients */
  --linear-fade: linear-gradient(
    180deg,
    #ffffff00,
    #ffffff08,
    #ffffff12,
    #ffffff1f,
    #ffffff2d,
    #ffffff3d,
    #ffffff4f,
    #ffffff63,
    #ffffff78,
    #ffffff8e,
    #ffffffa5,
    #ffffffbd,
    #ffffffd6,
    #ffffffef,
    #ffffff
  );
  --linear-fade-dark: linear-gradient(
    180deg,
    #00000000,
    #00000008,
    #00000010,
    #00000018,
    #00000020,
    #00000028,
    #00000030,
    #00000038,
    #00000040,
    #00000048,
    #00000050,
    #00000058,
    #00000060,
    #00000068,
    #00000070,
    #00000078,
    #00000080,
    #00000088,
    #00000090,
    #00000098,
    #000000a0,
    #000000a8,
    #000000b0,
    #000000b8,
    #000000c0,
    #000000c8
  );
  --linear-loader: linear-gradient(
    -45deg,
    #ececec,
    #f0f0f0,
    #f4f4f4,
    #f8f8f8,
    #fbfbfb,
    #f5f5f5,
    #f1f1f1,
    #ededed,
    #e9e9e9,
    #e5e5e5,
    #e1e1e1,
    #dddddd,
    #e0e0e0,
    #e4e4e4,
    #e8e8e8,
    #ececec
  );
  
  /* Control gradients */
  --linear-control-left: linear-gradient(
    -90deg,
    #ffffff00,
    #ffffff08,
    #ffffff12,
    #ffffff1f,
    #ffffff2d,
    #ffffff3d,
    #ffffff4f,
    #ffffff63,
    #ffffff78,
    #ffffff8e,
    #ffffffa5,
    #ffffffbd,
    #ffffffd6,
    #ffffffef,
    #ffffff
  );
  --linear-control-right: linear-gradient(
    90deg,
    #ffffff00,
    #ffffff08,
    #ffffff12,
    #ffffff1f,
    #ffffff2d,
    #ffffff3d,
    #ffffff4f,
    #ffffff63,
    #ffffff78,
    #ffffff8e,
    #ffffffa5,
    #ffffffbd,
    #ffffffd6,
    #ffffffef,
    #ffffff
  );
}

[data-theme="dark"] {
  --linear-action: linear-gradient(135deg, #4ECDC4, #FF6B6B);
  --linear-action-hover: linear-gradient(135deg, #6be2da, #ff8585);
  --linear-button: linear-gradient(#606672, #3f4b5a);
  --linear-button-hover: linear-gradient(#FF6B6B, #ff8585);
  
  --linear-success: linear-gradient(#10b981, #0d9968);
  --linear-error: linear-gradient(103.53deg, #c86e20 -6.72%, #d74a4a 109.77%);
  --linear-warn: linear-gradient(103.53deg, #c86e20 -6.72%, #d74a4a 109.77%);
  --linear-info: linear-gradient(#1a7dff, #0d5cd9);
  
  --linear-brand: linear-gradient(135deg, #FF6B6B 0%, #4ECDC4 100%);
  --linear-brand-alt: linear-gradient(0deg, #4ECDC4 0%, #FF6B6B 100%);
  --linear-brand-light: linear-gradient(90deg, #FF6B6B 0%, #4ECDC4 100%);
  --linear-brand-complex: linear-gradient(
    135deg,
    #4ECDC4 0%,
    #6be2da 20%,
    #FF6B6B 80%,
    #ff8585 100%
  );
  
  --linear-fade: linear-gradient(
    180deg,
    #05050500,
    #05050508,
    #05050512,
    #0505051f,
    #0505052d,
    #0505053d,
    #0505054f,
    #05050563,
    #05050578,
    #0505058e,
    #050505a5,
    #050505bd,
    #050505d6,
    #050505ef,
    #050505
  );
  --linear-fade-dark: linear-gradient(
    180deg,
    #ffffff00,
    #ffffff08,
    #ffffff12,
    #ffffff1f,
    #ffffff2d,
    #ffffff3d,
    #ffffff4f,
    #ffffff63,
    #ffffff78,
    #ffffff8e,
    #ffffffa5,
    #ffffffbd,
    #ffffffd6,
    #ffffffef,
    #ffffff
  );
  --linear-loader: linear-gradient(
    -45deg,
    #2a2a2a,
    #262626,
    #222222,
    #1e1e1e,
    #1a1a1a,
    #242424,
    #2e2e2e,
    #333333,
    #2f2f2f,
    #2b2b2b,
    #272727,
    #232323,
    #1f1f1f,
    #1a1a1a,
    #1e1e1e,
    #222222,
    #262626,
    #2a2a2a
  );
  
  --linear-control-left: linear-gradient(
    -90deg,
    #05050500,
    #05050508,
    #05050512,
    #0505051f,
    #0505052d,
    #0505053d,
    #0505054f,
    #05050563,
    #05050578,
    #0505058e,
    #050505a5,
    #050505bd,
    #050505d6,
    #050505ef,
    #050505
  );
  --linear-control-right: linear-gradient(
    90deg,
    #05050500,
    #05050508,
    #05050512,
    #0505051f,
    #0505052d,
    #0505053d,
    #0505054f,
    #05050563,
    #05050578,
    #0505058e,
    #050505a5,
    #050505bd,
    #050505d6,
    #050505ef,
    #050505
  );
}
"""

with open('web/src/tokens/primitives/linear.css', 'w') as f:
    f.write(content)
