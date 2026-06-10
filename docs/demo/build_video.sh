#!/bin/bash
# Builds a narrated MP4 demo: architecture intro + the four editor clips,
# each with a synthesized English voiceover. Local-only (ffmpeg + macOS `say`).
set -e
export PATH="/opt/homebrew/bin:$PATH"
cd "$(dirname "$0")"

VOICE="Daniel"        # en-GB
RATE=168
W=1280; H=650; FPS=15
WORK=$(mktemp -d)
echo "workdir: $WORK"

# section: name | visual | is_image | narration
build_section () {
  local name="$1" visual="$2" isimg="$3" text="$4"
  local aif="$WORK/$name.aiff" seg="$WORK/$name.mp4"
  printf '%s' "$text" > "$WORK/$name.txt"
  say -v "$VOICE" -r "$RATE" -f "$WORK/$name.txt" -o "$aif"
  local adur vdur
  adur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$aif")
  vdur=$(awk "BEGIN{print $adur + 0.8}")
  local padcolor="white"; [ "$isimg" = "1" ] && padcolor="0x0d1224"
  if [ "$isimg" = "1" ]; then
    ffmpeg -y -loglevel error -loop 1 -framerate $FPS -i "$visual" -i "$aif" \
      -filter_complex "[0:v]scale=$W:$H:force_original_aspect_ratio=decrease,pad=$W:$H:(ow-iw)/2:(oh-ih)/2:color=$padcolor,fps=$FPS,format=yuv420p[v];[1:a]aresample=48000,apad[a]" \
      -map "[v]" -map "[a]" -t "$vdur" -c:v libx264 -profile:v high -pix_fmt yuv420p -r $FPS -c:a aac -ar 48000 -ac 2 -b:a 128k "$seg"
  else
    ffmpeg -y -loglevel error -ignore_loop 0 -i "$visual" -i "$aif" \
      -filter_complex "[0:v]scale=$W:$H:force_original_aspect_ratio=decrease,pad=$W:$H:(ow-iw)/2:(oh-ih)/2:color=$padcolor,fps=$FPS,format=yuv420p[v];[1:a]aresample=48000,apad[a]" \
      -map "[v]" -map "[a]" -t "$vdur" -c:v libx264 -profile:v high -pix_fmt yuv420p -r $FPS -c:a aac -ar 48000 -ac 2 -b:a 128k "$seg"
  fi
  echo "file '$seg'" >> "$WORK/list.txt"
  echo "  $name: audio ${adur}s -> seg ${vdur}s"
}

: > "$WORK/list.txt"

build_section "01intro" "architecture.png" 1 \
"This is the Vonage connector for Zapier, version one point one. A user builds a Zap that describes what to send and over which channel. Zapier hands it to the connector, which signs in with just an API key and secret. Behind the scenes it finds or creates a managed Vonage application, signs every request with a JSON web token, and registers webhooks automatically. From there it reaches the Vonage APIs across S M S, R C S, WhatsApp, voice, and two factor verification."

build_section "02sms" "send-sms.gif" 0 \
"First, sending an S M S. The From field is a dropdown of your real Vonage numbers, so you just pick one. The message goes out through the Messages A P I and comes back with a message U U I D."

build_section "03rcs" "send-rcs.gif" 0 \
"Next, rich messaging over R C S. We choose the R C S channel and the registered agent as the sender. The connector signs it with the managed application, and the message is delivered to the handset."

build_section "04call" "make-call.gif" 0 \
"The connector also makes voice calls. We add a text to speech message, and it places the call through the Vonage Voice A P I. The phone rings and reads the message aloud."

build_section "05trigger" "trigger-rcs-inbound.gif" 0 \
"And it receives messages too. The inbound message trigger registers its webhook automatically when the Zap turns on, then pulls a real incoming record. Here it is an R C S message, with its channel, sender, and text. Connection with just a key and secret. The application, the signing, and the webhooks, all automatic. That is the Vonage connector, version one point one."

echo "concatenating..."
ffmpeg -y -loglevel error -f concat -safe 0 -i "$WORK/list.txt" -c copy vonage-connector-demo.mp4
echo "done: $(pwd)/vonage-connector-demo.mp4"
ffprobe -v error -show_entries format=duration:stream=width,height -of default=noprint_wrappers=1 vonage-connector-demo.mp4
rm -rf "$WORK"
