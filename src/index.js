// This code is based on the al-ro's work
//
// Copyright (c) 2020 - Jun Kato, al-ro, Takeshi Ishita - https://codepen.io/al-ro/pen/vYYYRaJ
//
// Permission is hereby granted, free of charge, to any person
// obtaining a copy of this software and associated documentation
// files (the "Software"), to deal in the Software without restriction,
//  including without limitation the rights to use, copy, modify,
// merge, publish, distribute, sublicense, and/or sell copies of
// the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall
// be included in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
// EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
// OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
// NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
// HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
// WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
// DEALINGS IN THE SOFTWARE.

import { Player, Ease } from "textalive-app-api";
import * as vertexSourceDict from '../assets/shader.vert';
import * as fragmentSourceDict from '../assets/shader.frag';

console.log("This code is provided under the MIT license with the following authors");
console.log("Jun Kato <i@junkato.jp> (https://junkato.jp)");
console.log("Takeshi Ishita <ishitah.takeshi@gmail.com> (https://ishitatakeshi.netlify.com/)");

const player = new Player({
  app: {
    appAuthor: "TextAlive",
    appName: "WebGL example",
  },
  mediaElement: "#media",
});

const IS_MOBILE = window.innerWidth < 500;

// begin / end time of chorus sections
let sectionBorderTimes = [];

var canvas = document.getElementById("canvas");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// Initialize the GL context
var gl = canvas.getContext('webgl2');
if(!gl){
  console.error("Unable to initialize WebGL.");
}

//************** Shader sources **************

var vertexSource = vertexSourceDict["default"];
var fragmentSource = fragmentSourceDict["default"];

//************** Utility functions **************

window.addEventListener('resize', onWindowResize, false);

function onWindowResize(){
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
	gl.viewport(0, 0, canvas.width, canvas.height);
  gl.uniform1f(widthHandle, window.innerWidth);
  gl.uniform1f(heightHandle, window.innerHeight);
}

//Compile shader and combine with source
function compileShader(shaderSource, shaderType){
  var shader = gl.createShader(shaderType);
  gl.shaderSource(shader, shaderSource);
  gl.compileShader(shader);
  if(!gl.getShaderParameter(shader, gl.COMPILE_STATUS)){
  	throw "Shader compile failed with: " + gl.getShaderInfoLog(shader);
  }
  return shader;
}

//From https://codepen.io/jlfwong/pen/GqmroZ
//Utility to complain loudly if we fail to find the attribute/uniform
function getAttribLocation(program, name) {
  var attributeLocation = gl.getAttribLocation(program, name);
  if (attributeLocation === -1) {
  	throw 'Cannot find attribute ' + name + '.';
  }
  return attributeLocation;
}

function getUniformLocation(program, name) {
  var attributeLocation = gl.getUniformLocation(program, name);
  if (attributeLocation === -1) {
  	throw 'Cannot find uniform ' + name + '.';
  }
  return attributeLocation;
}

//************** Create shaders **************

//Create vertex and fragment shaders
var vertexShader = compileShader(vertexSource, gl.VERTEX_SHADER);
var fragmentShader = compileShader(fragmentSource, gl.FRAGMENT_SHADER);

//Create shader programs
var program = gl.createProgram();
gl.attachShader(program, vertexShader);
gl.attachShader(program, fragmentShader);
gl.linkProgram(program);

gl.useProgram(program);

//Set up rectangle covering entire canvas
const vertexData = new Float32Array([
  -1.0,  1.0, 	// top left
  -1.0, -1.0, 	// bottom left
   1.0,  1.0, 	// top right
   1.0, -1.0, 	// bottom right
]);

//Create vertex buffer
var vertexDataBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, vertexDataBuffer);
gl.bufferData(gl.ARRAY_BUFFER, vertexData, gl.STATIC_DRAW);

// Layout of our data in the vertex buffer
var positionHandle = getAttribLocation(program, 'position');

gl.enableVertexAttribArray(positionHandle);
gl.vertexAttribPointer(
  positionHandle,
  2, 				// position is a vec2 (2 values per component)
  gl.FLOAT, // each component is a float
  false, 		// don't normalize values
  2 * 4, 		// two 4 byte float components per vertex (32 bit float is 4 bytes)
  0 				// how many bytes inside the buffer to start from
);

//Set uniform handle
var beatProgressHandle = getUniformLocation(program, 'beatProgress');
var beatExistsHandle = getUniformLocation(program, 'beatExists');
var beatIndexHandle = getUniformLocation(program, 'beatIndex');
var songTimeHandle = getUniformLocation(program, 'songTime');
var widthHandle = getUniformLocation(program, 'width');
var heightHandle = getUniformLocation(program, 'height');
var isMobileHandle = getUniformLocation(program, 'isMobile');
var sectionIndexHandle = getUniformLocation(program, 'sectionIndex');
var brightnessHandle = getUniformLocation(program, 'brightness');

gl.uniform1f(widthHandle, window.innerWidth);
gl.uniform1f(heightHandle, window.innerHeight);

var lastFrame = Date.now();
var thisFrame;

function calcBeatProgress(time, startTime, endTime) {
  return (time - startTime) / (endTime - startTime);
}

function sendIsMobileToShader() {
  gl.uniform1i(isMobileHandle, IS_MOBILE);
}

function sendBeatProgressToShader(beat, position) {
  if (beat == null) {
    gl.uniform1i(beatExistsHandle, 0);
    return;
  }

  gl.uniform1i(beatExistsHandle, 1);
  const beatProgress = calcBeatProgress(position, beat.startTime, beat.endTime);
  // subtract 1 because beat.position starts from 1
  gl.uniform1i(beatIndexHandle, beat.position - 1);
  gl.uniform1f(beatProgressHandle, beatProgress);
}

function sendSongTimeToShader(songTime) {
  gl.uniform1f(songTimeHandle, songTime);
}

function fadeOut(position) {
  let range = 800;  // milli second
  for (let borderTime of sectionBorderTimes) {
    if (position <= borderTime && borderTime - position <= range) {
      let k = (borderTime - position) / range;  // k <- [0.0, 1.0]
      return k * k;
    }
  }
  return 1.0;
}

function calcBrightness(progress) {
  return fadeOut(progress);
}

function setLyricsSize(size) {
  let element = document.querySelector("#lyrics");
  if (IS_MOBILE) {
    element.style.fontSize = "8.8vw";
  } else {
    element.style.fontSize = "4.8vw";
  }
}

function showLyricsAt(text) {
  /* document.querySelector("#lyrics").style.textAlign = horizontalPosition; */
  /* document.querySelector("#lyrics").style.verticalAlign = verticalPosition; */
  document.querySelector("#lyrics").textContent = text;
}

function getLyrics(songTime) {
  if (IS_MOBILE) {
    return player.video.findWord(songTime);
  }
  return player.video.findPhrase(songTime);
}

function showLyrics(lyricsObject) {
  if (!lyricsObject) {
    showLyricsAt("");
    return;
  }

  showLyricsAt(lyricsObject.text);
}

function sendBrightnessToShader(brightness) {
  gl.uniform1f(brightnessHandle, brightness);
}

// tell shader which animation should be drawn
function sendAnimationId(sectionIndex) {
  gl.uniform1i(sectionIndexHandle, sectionIndex);
}

function sectionIndex(position) {
  let n = sectionBorderTimes.length;
  if (position < sectionBorderTimes[0]) {
    return 0;
  }
  if (sectionBorderTimes[n-1] <= position) {
    return n;
  }

  for (let i = 0; i < sectionBorderTimes.length-1; i++) {
    if (sectionBorderTimes[i] <= position && position < sectionBorderTimes[i+1]) {
      return i + 1;
    }
  }

  throw "Unexpected song position";
}

function draw() {
  //Draw a triangle strip connecting vertices 0-4
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  requestAnimationFrame(draw);

  if(!player || !player.video || !player.timer) {
    return;
  }

  const position = player.timer.position;
  const beat = player.findBeat(position);
  sendBeatProgressToShader(beat, position);

  if (!player.timer.isPlaying) {
    return;
  }

  sendSongTimeToShader(position);

  let brightness = calcBrightness(position);
  sendBrightnessToShader(brightness);

  let chorus = player.findChorus(position);

  let index = sectionIndex(position)
  console.log("section index = ", index);
  sendAnimationId(index);

  showLyrics(getLyrics(position));
}

sendIsMobileToShader();

setLyricsSize();
draw();

const SONG_URL = "http://www.youtube.com/watch?v=XSLhsjepelI";

const shareMessage = "https://twitter.com/intent/tweet?text="
                   + "グリーンライツ・セレナーデを聴いてみませんか？ "
                   + window.location.href + "&hashtags=TextAlive";
const playButton = document.querySelector("#play");
const shareButton = document.querySelector("#twitter-share-button");
const overlay = document.querySelector("#overlay");

function hideOverlay() {
  overlay.style.display = "none";
}

function showOverlay() {
  overlay.style.display = "";
}

function initBorderTimes(choruses) {
  let times = [];
  for (let c of choruses) {
    times.push(c.startTime);
  }
  times.push(choruses[choruses.length-1].endTime);
  return times;
}

function hideShareButton() {
  shareButton.style.display = "none";
}

function showShareButton() {
  shareButton.href = shareMessage;
  shareButton.style.display = "block";
}

function hidePlayButton() {
  playButton.style.display = "none";
}

function showPlayButton() {
  playButton.style.display = "";
}

function enablePlayButton() {
  playButton.disabled = false;
}

showShareButton();
// hideShareButton();

player.addListener({
  onAppReady: (app) => {

    playButton.addEventListener(
      "click",
      () => { player.video && player.requestPlay(); }
    );
    if (!app.managed) {
      player.createFromSongUrl(SONG_URL);
    }
  },

  onVideoReady: () => {
  },

  onPlay: () => {
    console.log("player.onPlay");
    hideOverlay();
  },

  onPause: () => {
    console.log("player.onPause");
  },

  onSeek: () => {
    console.log("player.onSeek");
  },

  onStop: () => {
    showOverlay();
    hidePlayButton();
    showShareButton();

    if (!player.app.managed) {
      showPlayButton();
    }
    console.log("player.onStop");
  },

  onTimerReady: () => {
    if (!player.app.managed) {
      enablePlayButton();
    }

    let choruses = player.getChoruses();
    sectionBorderTimes = initBorderTimes(choruses);
  }
});
