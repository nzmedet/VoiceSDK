import { mediaDevices } from "react-native-webrtc";

export async function getLocalStream(): Promise<MediaStream> {
  try {
    const stream = await mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });
    return stream;
  } catch (error) {
    throw new Error(`Failed to get local media stream: ${error}`);
  }
}

