import { serve } from "bun";
import mongoose from "mongoose";
import { readFile } from "node:fs/promises";
import { Container } from "typedi";

import config from "./config";
import { filesFolder } from "./config/constants";
import IImageService from "./service/i-service/i-image.service";
import IBotUtilsService from "./service/i-service/telegram-bot/i-bot-utils.service";

const htmlHeaders = { 'Content-Type': 'text/html; charset=utf-8' };

export default () => {

  const imageService = Container.get(config.deps.service.image.name) as IImageService;
  const botUtils = Container.get(config.deps.service.botUtils.name) as IBotUtilsService;

  const getImage = async (encodedId: string) => {
    let id: string;
    try {
      id = decodeURIComponent(encodedId);
    } catch {
      return new Response('Bad ID', { status: 400 });
    }
    const img = await imageService.getById(id);
    if (!img)
      return new Response('Image not found', { status: 404 });
    return new Response(new Uint8Array(img.file.file), { headers: { 'Content-Type': 'application/octet-stream' } });
  };

  const getGallery = async () => {
    const allImages = await imageService.getAll();
    return new Response(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>The images</title>
</head>
<body>
    <div style="height: 80px; width: 100%"></div>
    <div style="text-align: center; font-family: Ubuntu,'Comic Sans MS',emoji">
    Available images
        <table> ${ allImages.map(i => `
          <tr>
              <td>${ i.file.id }</td>
              <td><img style="max-height: 300px; max-width: 500px" src="/image/${ i.file.id }" alt=""></td>
          </tr> `) }
        </table>
    </div>
</body>
</html>`, { headers: htmlHeaders });
  };

  const server = serve({
    port: Number(process.env.PORT || 15000),
    hostname: '::',
    async fetch(request) {
      if (request.method !== 'GET' && request.method !== 'HEAD')
        return new Response('Not found', { status: 404 });

      const path = new URL(request.url).pathname.replace(/\/$/, '');
      switch (path.toLowerCase()) {
        case '': {
          try {
            const html = await readFile(`${ filesFolder }/index.html`, 'utf8');
            return new Response(html, { headers: htmlHeaders });
          } catch {
            return new Response('Sorry, out of order', { status: 500 });
          }
        }
        case '/health': {
          const connected = mongoose.connection.readyState === 1;
          return Response.json({ status: connected ? 'ok' : 'unavailable' }, { status: connected ? 200 : 503 });
        }
        case '/images':
          return getGallery();
        default: {
          // Match the literal suffix before decoding an ID that may itself end in .png.
          const imagePath = /^\/image\/([^/]+?)(?:\.png)?$/i.exec(path);
          return imagePath ? getImage(imagePath[1]) : new Response('Not found', { status: 404 });
        }
      }
    },
    error(error) {
      console.error(error);
      return new Response('Internal Server Error', { status: 500 });
    },
  });

  Container.set('server', server);
  void botUtils.sendMessage(botUtils.adminChatId, 'Site is up in ' + config.runningEnv);
}
