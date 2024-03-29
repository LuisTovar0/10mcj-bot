# 10 McJ bot

Daily, I receive an audio and text from [10 Minutes with Jesus](https://10minuteswithjesus.org/). I'm responsible for forwarding them to Telegram and Signal after making a couple changes to the text.

<img align="right" style="width: 32%" src="../../wiki/bot-usage-screenshot.jpg">

That is a repetitive task that this repo's app automates. Currently, I just have to forward the text and audio to the [Telegram bot](https://t.me/dez_mcj_bot), and it gives me the text and audio messages ready to be forwarded to Telegram and Signal.

## List of features

+ Message handling in portuguese language
  + Format text messages for Signal
  + Format an audio+text (or just text if audio is missing) message for Telegram
+ As a security measure, persist how many messages a user sent to the bot. The bot can't read group messages nor be added to a group.
+ Image editing
  + Generate a thumbnail for the portuguese 10McJ channel
  + Add an image to the image database
  + Choose an image from the database to use in thumbnail generation

## Current works

The project is being upgraded now. The goal is to automate the entire process of publishing the 10 Minutes with Jesus meditations. These are the current goals:

+ Sending every message automatically
  + WhatsApp
  + Telegram
  + Signal
+ Posting the YouTube video automatically
  + Editing a cover image
  + Joining the image and the audio, using a video editing API
  + Posting the video on YouTube with the Google API
+ (Eventually) Posting the meditation to the podcast media (Spotify, Google Podcasts, etc.). This might not be needed since it is so quick and easy to do manually.

Check out the [wiki](https://github.com/LuisTovar0/10mcj-bot/wiki), where I plan the project.

## Developing

You can use this app to control your own bot. From here on out, a little knowledge about the [Telegram Bot API](https://core.telegram.org/bots) is useful to understand some topics.

### Running scripts

`npm start` is optimal for production because it compiles the TypeScript code to JavaScript and then runs the JS, which makes the app faster than if the TS is run directly with [`ts-node`](https://npmjs.com/package/ts-node).

However, `ts-node` is better for development because it doesn't allow the app to start if build is failing. So despite the coolness of the `npm run dev` script, which concurrently runs `tsc -w` and `nodemon build/app.js`, `npm run ts-dev` is most likely preferable. Note: in dev we're constantly recompiling the app, which leaves behind a `build/` directory, which doesn't happen in production builds. That's why compiling->running is no problem in production while making things confusing in dev.

Run tests with `npm run test`, but create a `.test.env` file first. Speaking of envs...

### Environment variables

Building the app requires the following environment variables to be defined:

+ `BOT_TOKEN`: the bot's Token, the one [The Botfather](https://t.me/BotFather) gave you.
+ `ADMIN_CHAT_ID`: the admin's Telegram chat ID (a number). In the case of this bot, it's my chat ID. This value can be found on the bot's [updates](https://core.telegram.org/bots).
+ `RUNNING_ENV`: self-explained. Accepts 'production', ' development' or 'test' as value.
+ `DB_TYPE`: accepts 'local' or 'mongodb' as values.
  + `MONGODB_URL`: if `DB_TYPE` is 'mongodb', the access URL should be specified. It's not necessary otherwise.
+ `CHANNEL`: if messages are meant to be sent directly to a Telegram channel, its public handler should be specified.

## Roadmap

(newest to oldest)

- [ ] Editing a video
- [x] Using CanvasJS to edit images
- [x] Webpage to view the images
- [x] Storing images
- [x] Persisting in-requests
