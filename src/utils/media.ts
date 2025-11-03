export async function getLocalStream(): Promise<MediaStream> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });
    return stream;
  } catch (error) {
    throw new Error(`Failed to get local media stream: ${error}`);
  }
}

