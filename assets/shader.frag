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

// Copyright © 2018 Inigo Quilez
// The original code is distributed under the MIT license
// https://www.iquilezles.org/www/articles/distfunctions2d/distfunctions2d.htm
// signed distance to a 2D triangle
float sdTriangle(in vec2 p0, in vec2 p1, in vec2 p2, in vec2 p)
{
	vec2 e0 = p1 - p0;
	vec2 e1 = p2 - p1;
	vec2 e2 = p0 - p2;

	vec2 v0 = p - p0;
	vec2 v1 = p - p1;
	vec2 v2 = p - p2;

	vec2 pq0 = v0 - e0*clamp( dot(v0,e0)/dot(e0,e0), 0.0, 1.0 );
	vec2 pq1 = v1 - e1*clamp( dot(v1,e1)/dot(e1,e1), 0.0, 1.0 );
	vec2 pq2 = v2 - e2*clamp( dot(v2,e2)/dot(e2,e2), 0.0, 1.0 );

    float s = sign( e0.x*e2.y - e0.y*e2.x );
    vec2 d = min( min( vec2( dot( pq0, pq0 ), s*(v0.x*e0.y-v0.y*e0.x) ),
                       vec2( dot( pq1, pq1 ), s*(v1.x*e1.y-v1.y*e1.x) )),
                       vec2( dot( pq2, pq2 ), s*(v2.x*e2.y-v2.y*e2.x) ));

	return -sqrt(d.x)*sign(d.y);
}

// https://stackoverflow.com/a/17897228
// The original code is distributed under the WTFPL license
vec3 hsv2rgb(vec3 hsv)
{
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(hsv.xxx + K.xyz) * 6.0 - K.www);
    return hsv.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), hsv.y);
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

vec2 spiralPosition(float t, float min_radius, float diffusion_rate, float offset_) {
  float omega = 2.0 * PI * t;
  float v = min_radius + diffusion_rate * t;
  return vec2(v * sin(omega + offset_), v * cos(omega + offset_));
}

float spiral(vec2 pos, float t, float min_radius, float diffusion_rate, float offset_) {
  vec2 points[POINT_COUNT];

  for(int i = 0; i < POINT_COUNT; i++) {
    // float u = float(i) * 0.25 + 0.01*t;
    float u = float(i)*0.01 + t;
    points[i] = spiralPosition(u, min_radius, diffusion_rate, offset_);
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

vec2 linePosition(float x, float y) {
  return vec2(x, y * height / width);
}

float line(vec2 pos, float t, float y) {
  vec2 points[POINT_COUNT];

  float scale = 1.4;
  for(int i = 0; i < POINT_COUNT; i++) {
    float t = float(i) * 0.1 + t * 0.5 * PI;
    float x = scale * (abs(sin(t)) - 0.5);
    points[i] = linePosition(x, y);
  }

  return drawSmooth(pos, points);
}

float star(vec2 pos, float size) {
  return abs(sdStar5(pos, size, 0.43));
}

float triangle(vec2 pos, float size, float angle_offset) {
  vec2 points[3];
  for(int i = 0; i < 3; i++) {
    float omega = float(i) * 2.0 * PI / 3.0 - PI / 6.0 - angle_offset;
    points[i] = vec2(size * cos(omega), size * sin(omega));
  }
  return abs(sdTriangle(points[0], points[1], points[2], pos));
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

    float intensity = 2.0;
    float radius = 0.008;

    if (beatExists == 0) {
      fragColor = vec4(vec3(0.0), 1.0);
      return;
    }

    float distance_;
    float glow;
    vec3 color = vec3(0.0);

    const vec3 green = vec3(0.0, 1.00, 0.4);
    const vec3 red = vec3(1.0, 0.05, 0.3);
    distance_ = spiral(pos, 0.5 * beatProgress, 0.1, 0.0, 0.0);
    glow = glowMagnitude(distance_, radius, intensity);
    color += calcColor(distance_, glow, red);

    distance_ = spiral(pos, 0.5 * beatProgress, 0.1, 0.0, PI);
    glow = glowMagnitude(distance_, radius, intensity);
    color += calcColor(distance_, glow, green);

    distance_ = line(pos, beatProgress, -0.3);
    glow = glowMagnitude(distance_, radius, intensity);
    color += calcColor(distance_, glow, red);

    distance_ = line(pos, beatProgress, 0.3);
    glow = glowMagnitude(distance_, radius, intensity);
    color += calcColor(distance_, glow, green);

    //Output to screen
    fragColor = vec4(color,1.0);
}
