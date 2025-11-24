export function forceSdpOptimization(sdp: string): string {
  // Remove heavy video/audio extensions
  sdp = sdp.replace(/a=rtcp-fb:111 transport-cc\r\n/g, '');
  sdp = sdp.replace(/a=extmap:\d+ .*transport-wide-cc.*\r\n/g, '');
  sdp = sdp.replace(/a=rtpmap:63 red\/48000\/2\r\n/g, '');
  sdp = sdp.replace(/a=fmtp:63 .*\r\n/g, '');
  sdp = sdp.replace(/a=extmap:\d+ .*abs-send-time.*\r\n/g, '');

  // Keep stereo /2 in rtpmap, just disable stereo in fmtp
  sdp = sdp.replace(
    /a=fmtp:111 .*\r\n/,
    'a=fmtp:111 minptime=10;useinbandfec=1;stereo=0;maxaveragebitrate=24000\r\n'
  );
  return sdp;
}