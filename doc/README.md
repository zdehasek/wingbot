# Wingbot Chatbot Framework

![wingbot chatbot logo](./logo.png "Wingbot Chatbot Framework")

[![CircleCI](https://circleci.com/gh/wingbotai/wingbot.svg?style=svg)](https://circleci.com/gh/wingbotai/wingbot)

Advanced chatbot framework gives you:

- Tools for making chatbot on for **Node.js**
- The simpliest interface for Messenger platform
- **Composable Conversation Blocks** system for separating concerns
- Familiar Node.js routing interface for **Fast development**
- **Unit tests** friendly bot framework


## How to start

  - **Install the framework**

    ```bash
    $ npm i -S wingbot
    ```


  - **Create your first chatbot**

    ```javascript
    const express = require('express');
    const { Router } = require('wingbot');

    const bot = new Router();

    bot.use('/hello', (req, res, postBack) => {
        res.text('Hello world');
    });

    bot.use((req, res, postBack) => {
        res.text('What you want?', {
            hello: 'Say hello world'
        });
    });

    const app = express();

    // @todo create documentation

    mongoose.connect('mongodb://localhost/myapp')
        .then(() => app.listen(3000));
    ```

  - **Deploy and setup Facebook Messenger Application**

    1. Create Facebook Application for Messenger platform
    2. Create page token and put it in Processor
    3. Create the webhook and use previously created `verifyToken`
    4. Subscribe a page to the FB Application

## Requirements

  - requires `mongoose` >= 4.0
  - requires `nodejs` >= 6.0
  - requires `express` >= 4.0
  - requires `body-parser` >= 1.10