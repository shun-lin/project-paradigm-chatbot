'use strict';

// Imports dependencies and set up http server

const 
  request = require('request'),
  express = require('express'),
  body_parser = require('body-parser'),
  // najax to replace jQuery Ajax
  najax = require('najax'),
  app = express().use(body_parser.json()), // creates express http server

  // news API
  NewsAPI = require('newsapi'),
  newsapi = new NewsAPI(process.env.NEWS_API_TOKEN);

// Sets server port and logs message on success
app.listen(process.env.PORT || 1337, () => console.log('webhook is listening'));

// Accepts POST requests at /webhook endpoint
app.post('/webhook', (req, res) => {  

  // Parse the request body from the POST
  let body = req.body;

  // Check the webhook event is from a Page subscription
  if (body.object === 'page') {

    // Iterate over each entry - there may be multiple if batched
    body.entry.forEach(function(entry) {

      // Get the webhook event. entry.messaging is an array, but 
      // will only ever contain one event, so we get index 0
      let webhook_event = entry.messaging[0];
      console.log(webhook_event);
      
      // Get the sender PSID
      let sender_psid = webhook_event.sender.id;
      console.log('Sender PSID: ' + sender_psid);
      
      // Check if the event is a message or postback and
      // pass the event to the appropriate handler function
      if (webhook_event.message) {
        handleMessage(sender_psid, webhook_event.message);        
      } else if (webhook_event.postback) {
        handlePostback(sender_psid, webhook_event.postback);
      }

      
    });

    // Return a '200 OK' response to all events
    res.status(200).send('EVENT_RECEIVED');

  } else {
    // Return a '404 Not Found' if event is not from a page subscription
    res.sendStatus(404);
  }

});

// Accepts GET requests at the /webhook endpoint
app.get('/webhook', (req, res) => {
  
  /** UPDATE YOUR VERIFY TOKEN **/
  const VERIFY_TOKEN = "feature_engineering_success";
  
  // Parse params from the webhook verification request
  let mode = req.query['hub.mode'];
  let token = req.query['hub.verify_token'];
  let challenge = req.query['hub.challenge'];
    
  // Check if a token and mode were sent
  if (mode && token) {
  
    // Check the mode and token sent are correct
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      
      // Respond with 200 OK and challenge token from the request
      console.log('WEBHOOK_VERIFIED');
      res.status(200).send(challenge);
    
    } else {
      // Responds with '403 Forbidden' if verify tokens do not match
      res.sendStatus(403);      
    }
  }
});

let lookup_keyword = "";

// helper functions
function getTodayDate() {
  let date = new Date();
  let today = date.getFullYear()+'-'+(date.getMonth()+1)+'-'+date.getDate();
  return today;
}

function getYesterdayDate() {
  
  // minus one full day (24 hours) to get yesterday's date
  let date = new Date(Date.now() - 864e5);
  let yesterday = date.getFullYear()+'-'+(date.getMonth()+1)+'-'+date.getDate();
  return yesterday;
}

// Handles messages events
function handleMessage(sender_psid, received_message) {
  let response = {
    "text": ""
  }
  
  // helper function in handleMessage
  function sendAnalysis(user_input) {
    
    najax({
              type: "POST",
              url: "http://127.0.0.1:5001/getScore",
              data: { mydata: user_input},
              success: function(retString) {

                var score = parseFloat(JSON.parse(retString).loss).toFixed(2);
                var analysis = JSON.parse(retString).analysis;
                var headline = JSON.parse(retString).headline;

                response.text = 'Headline: ' + headline;

                // add score
                response.text += '\n\n'
                response.text += 'Unusual score: ' + score.toString() + '.';

                // add analysis
                response.text += '\n\n'
                response.text += 'Analysis: ' + analysis;

                // Sends the response message
                callSendAPI(sender_psid, response);
              },
              error: function() {
                response.text = "We can not fetch the headline from the url you give us, please double check the url or type the headline into our chatbot!"
                // Sends the response message
                callSendAPI(sender_psid, response);
              }
          })
  }

  // Check if the message contains text
  if (received_message.text) {    
    
    let message_catched = false;
    let lower_case = received_message.text.toLowerCase().trim();
    
    // test if greeting through NLP
    const greeting = firstEntity(received_message.nlp, 'greetings');
    if (greeting && greeting.confidence > 0.8) {
      // Create greeting feedback
      response.text = 'hi! Welcome to Data-X Paradigm Team 2\'s Demo Messenger Bot.';
      response.text += '\n\n';
      response.text +=  'Please type \'commands\' to see a list of commands I understand!';
      message_catched  = true;
    }
    
    if (lower_case === "info") {
      // Create greeting feedback
      response.text = `This page is created for the demo chat bot for Data-X Paradigm Synthetic Features Engineering Team Spring 2019.`;
      message_catched  = true;
    }
    
    if (lower_case === "test") {
      // Create greeting feedback
      response.text = `If you see this message that means the test runs succesfully!`;
      message_catched  = true;
    }
    
    if (lower_case === "menu" || lower_case === "commands") {
      // Create greeting feedback
      response.text = "Tell me a cryptocurrency like \'bitcoin\' and I will fetch today\'s news about it and rank them for you!";
      response.text += "\n\n";
      response.text += "Use the special command \"unusual score:\" and send us a headline or an URL of a cryptocurrency article and we will analysize the unusual score of the article for you!";
      response.text += "\n\n";
      response.text += "Type \'help\' and we will notify our developer to solve your problems!";
      message_catched  = true;
    }
    
    if (lower_case === "help") {
      // Create greeting feedback
      response.text = `Our team has been notified, we will contact you about your problem shortly!`;
      message_catched  = true;
    } 
    
    // need to condense all those if statement into a for loop
    if (lower_case === "bitcoin") {
      response.text = `Do you want some news about bitcoin?`;
      lookup_keyword = "bitcoin";
      message_catched = true;
    }
    
    if (lower_case === "cryptocurrency") {
      response.text = `Do you want some news about general cryptocurrency?`;
      lookup_keyword = "cryptocurrency";
      message_catched = true;
    }
    
    if (lower_case === "blockchain") {
      response.text = `Do you want some news about blockchain?`;
      lookup_keyword = "blockchain";
      message_catched = true;
    }
    
    if (lower_case === "ethereum") {
      response.text = `Do you want some news about Ethereum?`;
      lookup_keyword = "ethereum";
      message_catched = true;
    }
    
    if (lower_case === "litecoin") {
      response.text = `Do you want some news about Litecoin?`;
      lookup_keyword = "litecoin";
      message_catched = true;
    }
    
    if (lower_case.includes("tell me") || lower_case.includes("give me news")) {
      
        // need to condense all those if statement into a for loop
      if (lower_case.includes("bitcoin")) {
        response.text = `Do you want some news about bitcoin?`;
        lookup_keyword = "bitcoin";
        message_catched = true;
      }

      if (lower_case.includes("cryptocurrency")) {
        response.text = `Do you want some news about general cryptocurrency?`;
        lookup_keyword = "cryptocurrency";
        message_catched = true;
      }

      if (lower_case.includes("blockchain")) {
        response.text = `Do you want some news about blockchain?`;
        lookup_keyword = "blockchain";
        message_catched = true;
      }

      if (lower_case.includes("ethereum")) {
        response.text = `Do you want some news about Ethereum?`;
        lookup_keyword = "ethereum";
        message_catched = true;
      }

      if (lower_case.includes("litecoin")) {
        response.text = `Do you want some news about Litecoin?`;
        lookup_keyword = "litecoin";
        message_catched = true;
      }
    }
    
    // need to condense all those if statement into a for loop ENDS
    
    if (lower_case === "no") {
      response.text = `Okay, let me know what other cyptocurrency do you want news for?`;
      lookup_keyword = "";
      message_catched = true;
    }
    
    //testing python
    if (lower_case.includes("testpython")) {
      
      najax({
            type: "POST",
            url: "http://127.0.0.1:5001/getScore",
            data: { mydata: "barbie kills mansion"},
            complete: function(retString) {
              response.text = "returning: " + JSON.parse(retString).loss;
              // Sends the response message
              callSendAPI(sender_psid, response);
            }
        })
      // response.text = "returning: " + "hi";
      message_catched = true;
    }
    
    if (lower_case.includes("unusual score: ")) {
      
      var received_data = lower_case.slice(15).trim();
      
      sendAnalysis(received_data);
      message_catched = true;
    }
    
    if (lower_case === "yes") {
      
      message_catched = true;
      
      if (lookup_keyword === null || lookup_keyword.length === 0) {
        response.text = `Please tell me a cyptocurrency to lookup first.`;
      }
      else {
        let today = getTodayDate();
        let yesterday = getYesterdayDate();
        newsapi.v2.everything({
          q: lookup_keyword,
          from: yesterday,
          to: today,
          language: 'en',
          sortBy: 'popularity',
          pageSize: '100',
        }).then(newsapi_response => {
          message_catched = true;

          let query_response = {
            "attachment": {
              "type": "template",
              "payload": {
                "template_type": "list",
                "top_element_style": "compact",
                "elements": []
              }
            }
          }

          let bitcoin_article;
          let title;
          let subtitle;
          let image_url;
          let url;
          let lst_element;

          var i;
          var articles_list = newsapi_response.articles;
          var num_articles_display = Math.min(articles_list.length, 4)
          for (i = 0; i < num_articles_display; i+=1) {
            bitcoin_article = articles_list[i];
            title = bitcoin_article.title;
            image_url = bitcoin_article.urlToImage;
            subtitle = bitcoin_article.description;
            url = bitcoin_article.url;

            lst_element = {
              "title": title,
              "subtitle": subtitle,
              "image_url": image_url,
              "default_action": {
                "type": "web_url",
                "url": url,
                "webview_height_ratio": "tall"
              }
            }

            query_response.attachment.payload.elements.push(lst_element);


          }
          
          if (articles_list.length == 0) {
            response.text = "Our source, newsApi.org, returns no " + lookup_keyword + " news for today. Please use our 'unusual score' functionality to get analysis on any cryptocurrency related article!";
            callSendAPI(sender_psid, response);
          }
          else {
            callSendAPI(sender_psid, query_response);
          }
          
          var j;
          var article_ele;
          var article_title;
          for (j = 0; j < query_response.attachment.payload.elements.length; j += 1) {
            article_ele = query_response.attachment.payload.elements[j];
            article_title = article_ele.title;
            sendAnalysis(article_title);
            
          }
          
          
        });
      }

      
    }
      
    if (!message_catched) { 
      // Create catch all feedback
      response.text = `Sorry I do not understand your command`    
    }
  
  }  
  
  // Sends the response message
  callSendAPI(sender_psid, response);
}

// Handles messaging_postbacks events
function handlePostback(sender_psid, received_postback) {

}

// Sends response messages via the Send API
function callSendAPI(sender_psid, response) {
  
  // Construct the message body
  let request_body = {
    "recipient": {
      "id": sender_psid
    },
    "message": response
  }

  // Send the HTTP request to the Messenger Platform
  request({
    "uri": "https://graph.facebook.com/v2.6/me/messages",
    "qs": { "access_token": process.env.PAGE_ACCESS_TOKEN },
    "method": "POST",
    "json": request_body
  }, (err, res, body) => {
    if (!err) {
      console.log('message sent!')
    } else {
      console.error("Unable to send message:" + err);
    }
  }); 
}

// for Facebook NLP
function firstEntity(nlp, name) {
  return nlp && nlp.entities && nlp.entities[name] && nlp.entities[name][0];
}