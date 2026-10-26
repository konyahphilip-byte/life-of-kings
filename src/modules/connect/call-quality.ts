import type { RoomOptions } from 'livekit-client';
export type CallDataMode='standard'|'saver'|'extreme';
/** Codec targets, not total network-byte or physical-device guarantees. */
export function callQuality(value:string):{mode:CallDataMode;allowCamera:boolean;options:RoomOptions} {
  const mode=value==='standard'||value==='extreme'?value:'saver';
  const standard=mode==='standard', extreme=mode==='extreme';
  const width=standard?1280:extreme?320:640, height=standard?720:extreme?180:360;
  const frameRate=standard?24:extreme?10:15;
  return {mode,allowCamera:!extreme,options:{
    adaptiveStream:true,dynacast:true,stopLocalTrackOnUnpublish:true,disconnectOnPageLeave:true,
    audioCaptureDefaults:{channelCount:1,echoCancellation:true,noiseSuppression:true,autoGainControl:true},
    videoCaptureDefaults:{resolution:{width,height,frameRate}},
    publishDefaults:{
      audioPreset:{maxBitrate:standard?24000:extreme?12000:16000},dtx:true,red:true,forceStereo:false,
      stopMicTrackOnMute:true,videoCodec:'vp8',simulcast:!extreme,
      videoEncoding:{maxBitrate:standard?1200000:extreme?100000:350000,maxFramerate:frameRate},
      degradationPreference:'maintain-framerate',
    },
  }};
}
