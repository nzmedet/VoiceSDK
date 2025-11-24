export function forceSdpOptimization(sdp: string): string {
  // Remove heavy features
  sdp = sdp.replace(/a=rtcp-fb:111 transport-cc\r\n/g, '');
  sdp = sdp.replace(/a=extmap:\d+ .*transport-wide-cc.*\r\n/g, '');
  sdp = sdp.replace(/a=rtpmap:63 red\/48000\/2\r\n/g, '');
  sdp = sdp.replace(/a=fmtp:63 .*\r\n/g, '');
  sdp = sdp.replace(/a=extmap:\d+ .*abs-send-time.*\r\n/g, '');

  // Force mono OPUS and cap bitrate
  sdp = sdp.replace(/opus\/48000\/2/g, 'opus/48000/1');
  sdp = sdp.replace(
    /a=fmtp:111 .*\r\n/,
    'a=fmtp:111 minptime=10;useinbandfec=1;stereo=0;maxaveragebitrate=24000\r\n'
  );
  return sdp;
}