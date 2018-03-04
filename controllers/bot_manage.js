const {Controller} = require("bak");
let fs = require('fs');
let Joi = require('joi');
const mongoose = require('mongoose');

const sabbDB = mongoose.createConnection('mongodb://localhost/sabb');
const BotSchema = mongoose.Schema({
  main: String,
  bot_token: String,
  db_url: String,
  db_name: String,
  output: String,
  mqtt_path: String,
  extra: {},
  owner: String,
  access: {},
}, {strict: false});

const Bot = sabbDB.model('Bot', BotSchema);

class BotManageController extends Controller {
  init() {
    this.defaults = {
      auth: {
        mode: 'required'
      }
    };

    this.get('/hello/{name}', this.hello);
    this.post('/bot/create', this.create);
    this.get('/bot/delete/{bot_id}', this.delete);
    this.get('/bot/{bot_id}', this.read);
  }

  hello(request, h) {
    return 'Hello ' + request.params.name + '!'
  }

  create(request, h) {
    let configs = request.payload;
    configs['owner'] = request.user._id;

    if (!configs.hasOwnProperty('access')) {
      configs.access = {}
    }
    configs.access['SKings'] = {
      'is_owner': true,
      'can_view': true,
      'can_edit': true,
      'can_delete': true,
      'can_code': true,
      'r_power': -1
    };

    configs.access[request.user._id] = {
      'is_owner': true,
      'can_view': true,
      'can_edit': true,
      'can_delete': true,
      'can_code': true,
      'r_power': 0
    };

    let bot = new Bot(configs);

    return bot.save()
      .then(bot => {
        configs.bot_id = bot._id;
        console.log('start reading main.js');
        let rawdata = fs.readFileSync('main.js', 'utf8');
        console.log('finish reading main.js');

        let keys = Object.keys(configs);

        keys.forEach(key => {
          const value = configs[key];
          console.log('adding config ' + key);
          let temp = '@@' + key + '@@';
          let regex = new RegExp(temp, 'g');
          rawdata = rawdata.replace(regex, "'" + value + "'");
        });
        // for (let i = 0; i < keys.length; i++) {
        //   console.log('adding config ' + keys[i]);
        //   let temp = '@@' + keys[i] + '@@';
        //   let regex = new RegExp(temp, 'g');
        //   rawdata = rawdata.replace(regex, "'" + configs[keys[i]] + "'");
        // }

        if (fs.existsSync(configs.output)) {
          fs.writeFileSync(configs.output + '/' + configs.main, rawdata, 'utf8')
        } else {
          fs.mkdirSync(configs.output);
          fs.writeFileSync(configs.output + '/' + configs.main, rawdata, 'utf8')
        }

        let result = {msg: 'Bot Created', bot_id: bot._id};
        return h.response(result).code(201);
      }).catch(err => {
        let result = {msg: 'bot save error'};
        console.log(err);
        bot.remove();
        return h.response(res).code(400);
      })
  }

  async delete(request, h) {
    const bot = await Bot.findById(request.params.bot_id);

    if (bot == null) {
      let result = {msg: 'Bot not found'};
      return h.response(result).code(404);
    }

    if (bot.access.hasOwnProperty(request.user._id)) {
      if (bot.access[request.user._id].can_delete) {
        bot.remove();
        let result = {msg: 'Bot Deleted'};
        return h.response(result).code(200);
      }
    }

    let result = {msg: 'Forbidden'};
    return h.response(result).code(403);
  }

  async read(request, h) {
    const bot = await Bot.findById(request.params.bot_id);

    if (bot == null) {
      let result = {msg: 'Bot not found'};
      return h.response(result).code(404);
    }

    if (bot.access.hasOwnProperty(request.user._id)) {
      if (bot.access[request.user._id].can_code) {
        return h.response(bot).code(200);
      }
    }

    let result = {msg: 'Forbidden'};
    return h.response(result).code(403);
  }
}

module.exports = BotManageController;