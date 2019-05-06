#!/usr/bin/python3

from flask import Flask, render_template, redirect, url_for,request
from flask import make_response
import sys

# machine learning libraries imports
import keras
import tensorflow as tf

from keras import backend as K
from keras import layers
from keras.models import Model, Sequential
from keras.layers import Dense, Embedding, Input, Lambda, LSTM, Masking, RepeatVector, TimeDistributed
from keras.preprocessing.text import Tokenizer
import numpy as np
import collections
import os
import string
import time
from segtok import tokenizer
from collections import Counter
import json

# import to read URLs
import requests # The requests library is an 
# HTTP library for getting and posting content etc.
import bs4 as bs # BeautifulSoup4 is a Python library 
# for pulling data out of HTML and XML code.

# this will validate whether we got a url or a title
import validators

import re
import string
import operator

# Using a basic RNN/LSTM for Language modeling
class LanguageModel():
    def __init__(self, input_length, vocab_size, rnn_size, learning_rate=1e-4):
        self.input_num = tf.placeholder(tf.int32, shape=[None, input_length])
        self.targets = tf.placeholder(tf.int32, shape=[None, input_length])
        self.targets_mask = tf.placeholder(tf.bool, shape=[None, input_length])
        self.embedding = tf.Variable(tf.random_uniform([vocab_size, rnn_size], -1.0, 1.0))
        input_emb = tf.nn.embedding_lookup(self.embedding, self.input_num)
        lm_cell = tf.nn.rnn_cell.LSTMCell(rnn_size)
        outputs, states = tf.nn.dynamic_rnn(lm_cell, input_emb, dtype=tf.float32)
        self.output_logits = tf.layers.dense(inputs=outputs, units=vocab_size)
        weights = tf.cast(self.targets_mask, tf.float32)
        self.loss = tf.losses.sparse_softmax_cross_entropy(labels=self.targets,logits=self.output_logits, weights=weights)
        optimizer = tf.train.AdamOptimizer(learning_rate=learning_rate, name='Adam')     
        self.global_step = tf.train.get_or_create_global_step()
        self.train_op = optimizer.minimize(self.loss, global_step=self.global_step)
        self.saver = tf.train.Saver()
        
input_length = 50
vocab_size = 6866

with open('vocab.txt') as f:
    content = f.readlines()
vocabulary = [x.strip() for x in content]
w2i = {w: i for i, w in enumerate(vocabulary)}
unkI, padI, startI = w2i['UNK'], w2i['PAD'], w2i['<START>']

#### helper methods ####

def numerize_sequence(tokenized):
    return [w2i.get(w, unkI) for w in tokenized]
  
def pad_sequence(numerized, pad_index, to_length):
    pad = numerized[:to_length]
    padded = pad + [pad_index] * (to_length - len(pad))
    mask = [w != pad_index for w in padded]
    return padded, mask

def build_batch(dataset, batch_size):
    
    # randomize the indices we want to get the batch of
    indices = list(np.random.randint(0, len(dataset), size=batch_size))
    
    # indice into the batch
    batch = [dataset[i] for i in indices]
    
    # Get the raw numerized for this input
    batch_numerized = np.asarray([db_element["numerized"] for db_element in batch])

    # Create an array of start_index that will be concatenated at position 1 for input
    start_tokens = np.zeros((batch_size, 1))
    batch_input = np.concatenate((start_tokens, batch_numerized), axis=1)

    # Remove the last word from each element in the batch to "shift" input
    batch_input = batch_input[:, :-1]
    
    # The target should be the un-shifted numerized input
    batch_target = batch_numerized

    # The target-mask is a 0 or 1 filter to note which tokens are
    # padding or not, to give the loss, so the model doesn't get rewarded for
    # predicting PAD tokens.
    batch_target_mask = np.array([a['mask'] for a in batch])
        
    return batch_input, batch_target, batch_target_mask

#### Helper function ends ####

tf.reset_default_graph()
default_graph = tf.get_default_graph()
model_file = "./tf_language_model"
model = LanguageModel(input_length=input_length, vocab_size=vocab_size, rnn_size=256, learning_rate=1e-4)

app = Flask(__name__)

@app.route("/")
def home():
    return "hi"

@app.route('/getScore', methods=['GET', 'POST'])
def getScore():
  if request.method == 'POST':
    data_received = request.form['mydata'].lower()
    is_url = validators.url(data_received)
    
    headline = ""
    if not is_url:
      # if we didn't get a url we got a headline as our data
      headline = data_received
    else:
      # we need to go fetch the headline from the url
      source = requests.get(data_received)
      soup = bs.BeautifulSoup(source.content, features='html.parser')
      headline = " "
      found_headline = False
      h1_tags = soup.find_all('h1')
      for h1_tag in h1_tags:
        potential_text = h1_tag.find(text=True, recursive=True)
        if len(potential_text) > 1:
          headline = potential_text
          found_headline = True
      
      if not found_headline:
        resp = make_response()
        resp.status = 400
        return resp

    with tf.Session(graph=default_graph) as sess:
      model.saver.restore(sess, model_file)

      tokenized = tokenizer.word_tokenizer(headline)
      numerized = numerize_sequence(tokenized)

      padded, mask = pad_sequence(numerized, padI, input_length)

      hl_element = {}
      hl_element['tokenized'] = tokenized
      hl_element['numerized'] = padded
      hl_element['mask'] = mask
      d_hl = [hl_element]
      hl_input, hl_target, hl_target_mask = build_batch(d_hl, 1)
      feed = {model.input_num: hl_input, model.targets: hl_target, model.targets_mask: hl_target_mask}
      loss = sess.run([model.loss], feed_dict=feed)[0]
      
      analysis = ''
      
      if loss < 7.00:
        analysis = "The headline is not unusual (not impactful). The article may not have any affect on cryptocurrency prices."
      elif loss < 15.00:
        analysis = "The headline is unusual (potentially impactful). The article may have an impact on cryptocurrency prices. We recommend reading the article!"
      else:
        analysis = "The headline is highly unusual (either potentially very impactful or not related to cryptocurrency). If the article is related to cryptocurrency, we recommend reading the article in detail!"
      
      resp = make_response('{"loss": '+str(loss)+', "headline": "'+headline+'"' + ', "analysis": "'+analysis+'"' + '}')
      resp.headers['Content-Type'] = "application/json"
        
      return resp

if __name__ == "__main__":
    app.run(debug = True)