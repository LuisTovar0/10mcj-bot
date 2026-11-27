# 10 McJ bot

A Telegram bot for sharing Portuguese [10 Minutes with Jesus](https://10minuteswithjesus.org/) meditations.
It prepares captioned audio for Telegram, formats text for Signal, and creates cover images.

## Using the Telegram bot

### Preview a meditation

Use `/pt_testar` and send the audio and text in two separate messages. The bot replies with the
captioned audio for Telegram and a version of the text you can forward on Signal.

### Create a cover

1. Start with `/pt_img <title>`. For an AI cover, the admin and approved editors can use
   `/pt_img_ai <title>` or **Criar capa com IA** in the Images menu when
   [AI thumbnail credentials](docs/docker.md#ai-thumbnail-credentials) are configured.
   If you omit the title or start from the menu, the bot asks for it.
2. Review the title, date, and background. You can edit the title, tap **Alterar data** and enter
   a date as `DD/MM/YYYY`, or send a photo or gallery ID to change the background.
3. Press **CRIAR IMAGEM** to generate the cover.

<details>
<summary>Backgrounds and AI cover styles</summary>

With `/pt_img_ai`, the same review message shows each edit, including a replacement background
photo. The review also lets you choose a horizontal or vertical layout and a regular
or special template. **Cor da linha** offers yellow and blue presets and accepts a typed color
such as `verde` or `#33AA77`. Your next AI draft uses the layout, template, and line color from
your last successfully delivered AI cover. Your first AI draft uses a regular vertical layout and a blue line.

The bot suggests the background from your last successfully delivered cover for either command.
If that background is unavailable, it tries your previous gallery choice and then the bundled
`rapaz.jpg`. Use `/chosen_img` to check the suggested background or `/img_choose <ID>` to change
the background of an active draft.

</details>

### Editor and admin permissions

In production, anyone can preview a meditation or a cover unless the admin has blocked them.
The admin and approved editors can add gallery photos with `/img_add` and publish meditations with
`/pt_enviar` when a Telegram channel is configured (`CHANNEL`). In development, only the admin and
approved editors have access. A block takes precedence over a grant.
Editors can get their own Telegram user ID from [@userinfobot](https://t.me/userinfobot) and send it
to the admin. Usernames can change without affecting permissions.

<details>
<summary>Admin commands and access lists</summary>

Only the admin can manage lists or run `/report`.

| Command                    | Action                 |
|----------------------------|------------------------|
| `/whitelist_add <user_id>` | Grant editor access    |
| `/whitelist_rm <user_id>`  | Remove editor access   |
| `/whitelist_all`           | Show approved user IDs |
| `/blacklist_add <user_id>` | Block a user           |
| `/blacklist_rm <user_id>`  | Remove a block         |
| `/blacklist_all`           | Show blocked user IDs  |

Add and remove commands accept one positive decimal ID up to `4503599627370495`, the
52-bit limit for [Telegram user IDs](https://core.telegram.org/bots/api#user). Repeating an add
command leaves a single entry.

[Migrating legacy access lists](docs/deployment.md#migrate-existing-access-lists)

</details>

## Project guides

- [Local setup with Docker](docs/docker.md)
- [Architecture, builds, and tests](docs/architecture.md)
- [Deploying to Fly.io](docs/deployment.md)

[MIT License](LICENSE.txt)
