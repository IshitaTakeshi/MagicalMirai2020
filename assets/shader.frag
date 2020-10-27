#version 300 es

precision highp float;

uniform float width;
uniform float height;

#define PI 3.1415926538

uniform float beatProgress;
uniform int beatExists;
uniform int beatIndex;
uniform float songTime;

#define POINT_COUNT 4

// https://www.shadertoy.com/view/MlKcDD
// Copyright © 2018 Inigo Quilez
// Signed distance to a quadratic bezier
// The original code is distributed under the MIT license
float sdBezier(vec2 pos, vec2 A, vec2 B, vec2 C){
    vec2 a = B - A;
    vec2 b = A - 2.0*B + C;
    vec2 c = a * 2.0;
    vec2 d = A - pos;

    float kk = 1.0 / dot(b,b);
    float kx = kk * dot(a,b);
    float ky = kk * (2.0*dot(a,a)+dot(d,b)) / 3.0;
    float kz = kk * dot(d,a);

    float res = 0.0;

    float p = ky - kx*kx;
    float p3 = p*p*p;
    float q = kx*(2.0*kx*kx - 3.0*ky) + kz;
    float h = q*q + 4.0*p3;

    if(h >= 0.0){
        h = sqrt(h);
        vec2 x = (vec2(h, -h) - q) / 2.0;
        vec2 uv = sign(x)*pow(abs(x), vec2(1.0/3.0));
        float t = uv.x + uv.y - kx;
        t = clamp( t, 0.0, 1.0 );

        // 1 root
        vec2 qos = d + (c + b*t)*t;
        res = length(qos);
    }else{
        float z = sqrt(-p);
        float v = acos( q/(p*z*2.0) ) / 3.0;
        float m = cos(v);
        float n = sin(v)*1.732050808;
        vec3 t = vec3(m + m, -n - m, n - m) * z - kx;
        t = clamp( t, 0.0, 1.0 );

        // 3 roots
        vec2 qos = d + (c + b*t.x)*t.x;
        float dis = dot(qos,qos);

        res = dis;

        qos = d + (c + b*t.y)*t.y;
        dis = dot(qos,qos);
        res = min(res,dis);

        qos = d + (c + b*t.z)*t.z;
        dis = dot(qos,qos);
        res = min(res,dis);

        res = sqrt( res );
    }

    return res;
}

// Copyright © 2018 Inigo Quilez
// The original code is distributed under the MIT license
// https://www.iquilezles.org/www/articles/distfunctions2d/distfunctions2d.htm
// signed distance to a 5-star polygon
float sdStar5(in vec2 p, in float r, in float rf)
{
    const vec2 k1 = vec2(0.809016994375, -0.587785252292);
    const vec2 k2 = vec2(-k1.x,k1.y);
    p.x = abs(p.x);
    p -= 2.0*max(dot(k1,p),0.0)*k1;
    p -= 2.0*max(dot(k2,p),0.0)*k2;
    p.x = abs(p.x);
    p.y -= r;
    vec2 ba = rf*vec2(-k1.y,k1.x) - vec2(0,1);
    float h = clamp( dot(p,ba)/dot(ba,ba), 0.0, r );
    return length(p-ba*h) * sign(p.y*ba.x-p.x*ba.y);
}

//https://www.shadertoy.com/view/3s3GDn
float glowMagnitude(float dist, float radius, float intensity) {
    return pow(radius/dist, intensity);
}

float drawSmooth(vec2 pos, vec2 points[POINT_COUNT]) {
  vec2 c = (points[0] + points[1]) / 2.0;
  vec2 c_prev;
  float dist = 10000.0;

  for(int i = 0; i < POINT_COUNT-1; i++){
      //https://tinyurl.com/y2htbwkm
      c_prev = c;
      c = (points[i] + points[i+1]) / 2.0;
      dist = min(dist, sdBezier(pos, c_prev, points[i], c));
  }
  return max(0.0, dist);
}

vec2 spiralPosition(float t) {
  float omega = 2.0 * PI * t;
  float v = 0.3 + 0.003 * t;
  return vec2(v * sin(omega), v * cos(omega));
}

float spiral(vec2 pos, float beatProgress) {
  vec2 points[POINT_COUNT];

  for(int i = 0; i < POINT_COUNT; i++) {
      points[i] = spiralPosition(beatProgress);
  }

  return drawSmooth(pos, points);
}

// https://codepen.io/al-ro/pen/BaaBage
vec2 heartPosition(float t) {
  float scale = -0.01;
  return scale * vec2(16.0 * sin(t) * sin(t) * sin(t),
                      -(13.0 * cos(t) - 5.0 * cos(2.0*t) - 2.0 * cos(3.0*t) - cos(4.0*t)));
}

float heart(vec2 pos, float t) {
  vec2 points[POINT_COUNT];

  for(int i = 0; i < POINT_COUNT; i++) {
    points[i] = heartPosition(float(i) * 0.25 + 0.01*t);
  }

  return drawSmooth(pos, points);
}

vec2 linePosition(float t) {
  float speed = 1.2;
  float x = speed * (abs(sin(t)) - 0.5);
  float y = 0.5 - 0.2 * float(beatIndex);
  return vec2(x, y * height / width);
}

float line(vec2 pos, float beatProgress) {
  vec2 points[POINT_COUNT];

  for(int i = 0; i < POINT_COUNT; i++) {
      points[i] = linePosition(float(i) * 0.1 + beatProgress * 0.5 * PI);
  }

  return drawSmooth(pos, points);
}

vec3 calcColor(float distance_, float glowMagnitude, vec3 glowColor) {
  // white core
  vec3 color = 10.0 * vec3(smoothstep(0.003, 0.001, distance_));

  color += glowMagnitude * glowColor;

  //Tone mapping
  color = 1.0 - exp(-color);

  //Gamma
  return pow(color, vec3(0.4545));
}

out vec4 fragColor;

void main(){
    vec2 resolution = vec2(width, height);

    vec2 uv = gl_FragCoord.xy/resolution.xy;
    vec2 centre = vec2(0.5, 0.5);
    vec2 pos = uv - centre;
    pos.y *= height / width;
    vec3 glowColor = vec3(1.0,0.05,0.3);

    if (beatExists == 0) {
      fragColor = vec4(vec3(0.0), 1.0);
      return;
    }

    float distance_;
    float glow;
    vec3 color = vec3(0.0);

    distance_ = line(pos, beatProgress);
    glow = glowMagnitude(distance_, radius, intensity);
    color += calcColor(distance_, glow, glowColor);

    distance_ = spiral(pos, beatProgress);
    glow = glowMagnitude(distance_, radius, intensity);
    color += calcColor(distance_, glow, glowColor);

    //Output to screen
    fragColor = vec4(color,1.0);
}
