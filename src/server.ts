import express from "express";
import {Container} from "typedi";
import fs from "fs";

import config from "./config";
import {filesFolder} from "./config/constants";
import IBotUtilsService from "./service/iService/telegramBot/iBotUtils.service";
import IImageService from "./service/iService/iImage.service";

export default () => {

  const app = express();

  app.get('/', (req, res) =>
    fs.readFile(`${filesFolder}/index.html`, 'utf8', (err, html) => {
      if (err) res.status(500).send('Sorry, out of order');
      res.send(html);
    })
  );

  const imageService = Container.get(config.deps.service.image.name) as IImageService;
  const botUtils = Container.get(config.deps.service.botUtils.name) as IBotUtilsService;

  app.get('/image/:id.png', async (req, res) => {
    if (!req.params.id)
      return res.status(400).send('Bad ID');
    const id = req.params.id/*.split('.')[0]*/;
    const img = await imageService.getById(id);
    if (!img)
      return res.status(404).send('Image not found');
    res.send(img.file.file);
  });

  app.get('/images', async (req, res) => {
    const allImages = await imageService.getAll();
    res.send(`
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
        <table> ${allImages.map(i => {
      return `
          <tr>
              <td>${i.file.id}</td>
              <td><img style="max-height: 300px; max-width: 500px" src="/image/${i.file.id}.png" alt=""></td>
          </tr> `;
    })} </table>
    </div>
</body>
</html>`);
  });

  const server = app.listen(process.env.PORT || 15000, async () => {
    await botUtils.sendMessage(botUtils.adminChatId, 'Site is up in ' + config.runningEnv);
  });

  Container.set('server', server);
}
