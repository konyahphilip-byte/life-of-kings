import { describe, expect, it } from 'vitest';
import { callQuality } from './call-quality';

describe('call bandwidth policy', () => {
  it('uses speech audio, visible-track adaptation and idle-layer suspension in Standard mode', () => {
    const policy=callQuality('standard');
    expect(policy.options.adaptiveStream).toBe(true);
    expect(policy.options.dynacast).toBe(true);
    expect(policy.options.audioCaptureDefaults?.channelCount).toBe(1);
    expect(policy.options.publishDefaults?.audioPreset?.maxBitrate).toBe(24000);
    expect(policy.options.publishDefaults?.dtx).toBe(true);
    expect(policy.options.videoCaptureDefaults?.resolution).toEqual({width:1280,height:720,frameRate:24});
    expect(policy.options.publishDefaults?.videoEncoding).toEqual({maxBitrate:1200000,maxFramerate:24});
  });
  it('caps Data Saver capture and publication below Standard without requiring music audio', () => {
    const p=callQuality('saver');
    expect(p.options.videoCaptureDefaults?.resolution).toEqual({width:640,height:360,frameRate:15});
    expect(p.options.publishDefaults?.videoEncoding).toEqual({maxBitrate:350000,maxFramerate:15});
    expect(p.options.publishDefaults?.audioPreset?.maxBitrate).toBe(16000);
    expect(p.allowCamera).toBe(true);
  });
  it('starts Extreme Saver with audio-only controls and a low audio target', () => {
    const p=callQuality('extreme');
    expect(p.allowCamera).toBe(false);
    expect(p.options.publishDefaults?.audioPreset?.maxBitrate).toBe(12000);
    expect(p.options.publishDefaults?.simulcast).toBe(false);
  });
  it('uses bounded Data Saver settings for an unknown saved setting', () => {
    const p=callQuality('corrupted');
    expect(p.mode).toBe('saver');
    expect(p.options.publishDefaults?.videoEncoding?.maxBitrate).toBe(350000);
  });
  it('does not share mutable capture options between calls', () => {
    const first=callQuality('saver'); first.options.videoCaptureDefaults!.resolution={width:9000,height:9000};
    expect(callQuality('saver').options.videoCaptureDefaults?.resolution).toEqual({width:640,height:360,frameRate:15});
  });
});
