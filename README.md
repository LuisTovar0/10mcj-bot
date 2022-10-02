# 10 McJ bot

Every day I receive an audio and text from [10 Minutes with Jesus](https://10minuteswithjesus.org/). I'm responsible for forwarding them to Telegram and Signal, but making a couple changes to the text.

<img align="right" style="width: 30%" src="../../wiki/bot-usage-screenshot.jpg">

That is a repetitive task that this repo's app automates. Currently, I just have to forward the text and audio to the [Telegram bot](https://t.me/dez_mcj_bot), and it gives me the text and audio messages ready to be forwarded to Telegram and Signal.

## Current works

The project is being upgraded now. The goal is to automate the entire process of publishing the 10 Minutes with Jesus meditations. These are the current goals:

+ Sending every message automatically
    + WhatsApp
    + Telegram
    + Signal
+ Posting the YouTube video automatically
    + Editing a cover image using the [Pixio Editor API](https://pixoeditor.com/documentation/editing-api/)
    + Joining the image and the audio, using a video editing API (not yet planned)
    + Posting the video on YouTube with the Google API
+ (Eventually) Posting the meditation to the podcast media (Spotify, Google Podcasts, etc.). This might not be needed since it is so quick and easy to do manually.

Check out the [wiki](https://github.com/LuisTovar0/10mcj-bot/wiki), where I plan the project.
