#version 300 es

precision highp float;

uniform float width;
uniform float height;

#define PI 3.1415926538

uniform float beatProgress;
uniform int beatExists;
uniform int beatIndex;
uniform float songTime;
uniform float chorusIndex;
uniform float chorusExists;
uniform bool isMobile;
uniform int animationId;

const float intensity = 5.0;
const float radius = 0.008;

#define N_COLORS 5
#define POINT_COUNT 4

const vec3 color_meiko = vec3(1, 0, 0);
const vec3 color_rinlen = vec3(1, 1, 0);
const vec3 color_miku = vec3(0, 1, 1);
const vec3 color_kaito = vec3(0, 0, 1);
const vec3 color_luka = vec3(1, 0, 1);

vec3[N_COLORS] getCryptonColors() {
    vec3 crypton_colors[N_COLORS];
    crypton_colors[0] = color_meiko;
    crypton_colors[1] = color_rinlen;
    crypton_colors[2] = color_miku;
    crypton_colors[3] = color_kaito;
    crypton_colors[4] = color_luka;
    return crypton_colors;
}

// https://stackoverflow.com/a/17897228
// The original code is distributed under the WTFPL license
vec3 hsv2rgb(vec3 hsv) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(hsv.xxx + K.xyz) * 6.0 - K.www);
    return hsv.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), hsv.y);
}

// https://www.shadertoy.com/view/3tdSDj
// Copyright © 2018 Inigo Quilez
// Signed distance to a quadratic bezier
// The original code is distributed under the MIT license
float udSegment( in vec2 p, in vec2 a, in vec2 b )
{
    vec2 ba = b-a;
    vec2 pa = p-a;
    float h =clamp( dot(pa,ba)/dot(ba,ba), 0.0, 1.0 );
    return length(pa-h*ba);
}

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
// https://www.shadertoy.com/view/3tSGDy
float sdStar(in vec2 p, in float r, in int n, in float m)
{
    // next 4 lines can be precomputed for a given shape
    float an = 3.141593/float(n);
    float en = 3.141593/m;  // m is between 2 and n
    vec2  acs = vec2(cos(an),sin(an));
    vec2  ecs = vec2(cos(en),sin(en)); // ecs=vec2(0,1) for regular polygon,

    float bn = mod(atan(p.x,p.y),2.0*an) - an;
    p = length(p)*vec2(cos(bn),abs(sin(bn)));
    p -= r*acs;
    p += ecs*clamp( -dot(p,ecs), 0.0, r*acs.y/ecs.y);
    return length(p)*sign(p.x);
}

// Copyright © 2018 Inigo Quilez
// The original code is distributed under the MIT license
// https://www.iquilezles.org/www/articles/distfunctions2d/distfunctions2d.htm
float sdOrientedBox( in vec2 p, in vec2 a, in vec2 b, float th )
{
    float l = length(b-a);
    vec2  d = (b-a)/l;
    vec2  q = (p-(a+b)*0.5);
          q = mat2(d.x, -d.y,
                   d.y,  d.x) * q;
          q = abs(q)-vec2(l,th)*0.5;
    return length(max(q,0.0)) + min(max(q.x,q.y),0.0);
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

vec2 spiralPosition(float r, float theta) {
  float omega = 2.0 * PI * theta;
  return vec2(r * sin(omega), r * cos(omega));
}

float spiral(vec2 pos, float theta) {
  return length(pos - spiralPosition(0.1, theta));
}

// https://codepen.io/al-ro/pen/BaaBage
vec2 heartPosition(float t) {
  float x = 16.0 * sin(t) * sin(t) * sin(t);
  float y = -(13.0 * cos(t) - 5.0 * cos(2.0*t) - 2.0 * cos(3.0*t) - cos(4.0*t));
  return -0.07 * vec2(x, y);
}

float heart(vec2 pos, float size, float t) {
  vec2 points[POINT_COUNT];

  for(int i = 0; i < POINT_COUNT; i++) {
    points[i] = size * heartPosition(float(i) * 0.2 + 2.0 * PI * t);
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
  return abs(sdStar(pos, size, 5, 3.0)); // 0.382));
}

float rectangle(vec2 pos, vec2 a, vec2 b, float theta) {
  return abs(sdOrientedBox(pos, a, b, theta));
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

vec3 showRectangleFlower(vec2 pos, vec2 offset_, int n_petals) {
  float d = 0.2;
  vec3 color = vec3(0.0);
  for(int i = 0; i < n_petals; i++) {
    float angle = float(i) * 2.0 * PI / float(n_petals);
    float da = 2.0 * PI / (float(n_petals) * 16.0);
    float angle1 = angle - da;
    float angle2 = angle + da;
    // vec2 p = pos - d * vec2(sin(angle), cos(angle));
    vec2 p1 = vec2(cos(angle1), sin(angle1));
    vec2 p2 = vec2(cos(angle2), sin(angle2));
    float distance_ = rectangle(pos + offset_, d * p1, d * p2, 0.1);
    // triangle(pos - d * vec2(sin(angle), cos(angle)), 0.01, angle);
    float glow = 0.05 * glowMagnitude(distance_, 0.001, intensity);
    float k = songTime * 0.00002;
    vec3 rgb = hsv2rgb(vec3(k - round(k), 1.0, 1.0));
    color += calcColor(distance_, glow, rgb);
  }
  return color;
}

vec3 showStar(vec2 pos, float size, vec3 rgb) {
  float distance_ = star(pos, size);
  float glow = glowMagnitude(distance_, radius, 8.0);
  return calcColor(distance_, glow, rgb);
}

vec3 showRotatedRectangle(vec2 pos, float size, float theta, vec3 rgb) {
  float da = PI / 2.0;
  float angle1 = theta - da;
  float angle2 = theta + da;
  vec2 p1 = vec2(cos(angle1), sin(angle1));
  vec2 p2 = vec2(cos(angle2), sin(angle2));
  float distance_ = rectangle(pos, size * p1, size * p2, 2.0 * size);
  float glow = 2.0 * glowMagnitude(distance_, radius, 2.0);
  return calcColor(distance_, glow, rgb);
}

vec3 showHorizontalBeams(vec2 pos, int beatIndex, float beatProgress) {
  int i = min(3, beatIndex);  // max beat index = 1
  float ys[4] = float[](-0.3, -0.1, 0.1, 0.3);
  vec3 colors[4] = vec3[](color_rinlen, color_rinlen, color_miku, color_luka);
  float distance_ = line(pos, beatProgress, ys[i]);
  float glow = 0.1 * glowMagnitude(distance_, radius, intensity);
  return calcColor(distance_, glow, colors[i]);
}

vec3 showStarTunnel(vec2 pos, float time) {
  vec3 crypton_colors[N_COLORS] = getCryptonColors();

  vec3 color = vec3(0.0);

  int n_layers = N_COLORS * 4;
  for (int i = 0; i < n_layers; i++) {
    float g = fract(time + float(i) / float(n_layers));
    vec2 p = (pos + vec2(0.5 * (1.0-g), 0.0)) * mix(100.0, 0.0, g);
    float angle = -2.0 * PI * float(i) / (float(n_layers) * 5.0);
    mat2 rotation = mat2(cos(angle), -sin(angle),
		                     sin(angle),  cos(angle));
    p = rotation * p;
    color += showStar(p, g, crypton_colors[i % N_COLORS]);
  }
  return color;
}

vec3 showRectangleTunnel(vec2 pos, float time) {
  vec3 crypton_colors[N_COLORS] = getCryptonColors();

  vec3 color = vec3(0.0);

  int n_layers = N_COLORS * 4;
  for (int i = 0; i < n_layers; i++) {
    float g = fract(time + float(i) / float(n_layers));
    vec2 p = (pos - vec2(0.5 * (1.0-g), 0.0)) * mix(100.0, 0.0, g);
    color += showRotatedRectangle(p, g, 0.0, crypton_colors[i % N_COLORS]);
  }
  return color;
}

vec3 showHeart(vec2 pos, float size, float time, vec3 color1, vec3 color2) {
  vec3 color = vec3(0.0);
  float distance_;
  float glow;

  distance_ = heart(pos, size, time + 0.0);
  glow = glowMagnitude(distance_, radius, intensity);
  color += calcColor(distance_, glow, color1);

  distance_ = heart(pos, size, time + 0.5);
  glow = glowMagnitude(distance_, radius, intensity);
  color += calcColor(distance_, glow, color2);

  return color;
}

vec3 showSpiral(vec2 pos, float size, float time, vec3 colors[N_COLORS]) {
  vec3 color = vec3(0.0);

  float min_radius = 0.2; // fract(time);

  for (int c = 0; c < N_COLORS; c++) {
    vec2 positions[POINT_COUNT];
    float color_offset = float(c) / float(N_COLORS);
    for (int i = 0; i < POINT_COUNT; i++) {
      float r = min_radius + float(i) * 0.1;
      float theta = -time + color_offset + float(i) * 0.1;
      positions[i] = spiralPosition(r, theta);
      // float distance_ = spiral(pos, t);
    }
    float distance_ = drawSmooth(pos, positions);
    float glow = 0.004 * glowMagnitude(distance_, radius, 8.0);
    color += calcColor(distance_, glow, colors[c]);
  }
  return color;
}

float logistic(float t, float alpha, float beta) {
  return 1.0 / (1.0 + exp(-alpha * (t - beta)));
}

float rotatingBeam(vec2 pos, float r1, float r2,
                   float omega, float beam_time) {
  float t1 = omega;
  float t2 = t1;
  vec2 p1 = r1 * vec2(cos(t1), sin(t1));
  vec2 p2 = r2 * vec2(cos(t2), sin(t2));

  float k = fract(beam_time);
  float a1 = logistic(k, 10.0, 0.26);
  float a2 = logistic(k, 10.0, 0.37);
  vec2 s1 = p2 + a1 * (p1 - p2);
  vec2 s2 = p2 + a2 * (p1 - p2);

  return udSegment(pos, s1, s2);
}

vec3 showRotatingBeams(vec2 pos, float r1, float r2, float t) {
  vec3 crypton_colors[N_COLORS] = getCryptonColors();

  vec3 color = vec3(0.0);
  int n_offsets = 2;
  for (int j = 0; j < n_offsets; j++) {
    float omega_offset = 2.0 * PI * float(j) / float(n_offsets) + 0.4 * t;
    float beam_offset = 0.0 * float(j);

    int n = N_COLORS * 5;
    for (int i = 0; i < n; i++) {
      int k = i % N_COLORS;
      float omega = 2.0 * PI * t + 2.0 * PI * float(i) / float(n) + omega_offset;
      float beam_time = 2.0 * t + float(i) / float(n) + beam_offset;
      float distance_ = rotatingBeam(pos, r1, r2, omega, beam_time);
      float glow = glowMagnitude(distance_, radius, intensity);
      color += calcColor(distance_, glow, crypton_colors[k]);
    }
  }
  return color;
}

float getCenterObjectSize() {
  if (isMobile) {
    return 0.3;
  }
  return 0.10;
}

vec3 starWithParticles(vec2 pos) {
  float center_object_size = getCenterObjectSize();
  vec3 color = vec3(0.0);
  color += showStar(pos, center_object_size, color_rinlen);
  color += showRotatingBeams(pos, 1.0, center_object_size + 0.03, 0.0002 * songTime);
  return color;
}

vec3 heartWithParticles(vec2 pos) {
  float center_object_size = getCenterObjectSize();
  vec3 color = vec3(0.0);
  color += showHeart(pos, center_object_size, 0.0008 * songTime,
                     color_meiko, color_kaito);
  color += showRotatingBeams(pos, 1.0, center_object_size + 0.03, 0.0002 * songTime);
  return color;
}

vec3 rectangleTunnel(vec2 pos) {
  return showRectangleTunnel(pos, songTime * 0.0001);
}

vec3 starTunnel(vec2 pos) {
  return showStarTunnel(pos, songTime * 0.0001);
}


vec3 animation(vec2 pos, int animation_id) {
  if (animation_id == 1) {
    return heartWithParticles(pos);
  }

  if (animation_id == 2) {
    return starWithParticles(pos);
  }

  return vec3(0.0);
}

void main() {
    vec2 resolution = vec2(width, height);

    vec2 uv = gl_FragCoord.xy/resolution.xy;
    vec2 centre = vec2(0.5, 0.5);
    vec2 pos = uv - centre;
    pos.y *= height / width;

    float center_object_size = getCenterObjectSize();
    vec3 crypton_colors[N_COLORS] = getCryptonColors();
    // vec3 color = vec3(0.0);

    // float time = 0.0008 * songTime;
    // color += showHeart(pos, time, color_meiko, color_kaito);

    // color += showStar(pos, center_object_size, color_rinlen);

    // color += showRectangleFlower(pos * mix(1.0, 0.0, 0.5), vec2(0.0, 0.0 * height / width), 16);
    // color += showRectangleFlower(pos, vec2(-0.4, -0.4 * height / width), 16);

    // float k = 0.0002 * songTime;
    // color += showSpiral(pos, 0.1, k, crypton_colors);

    // color += showRotatingBeams(pos, 1.0, center_object_size + 0.03, k);
    // color += showHorizontalBeams(pos, beatIndex, beatProgress);
    // color += showRectangleTunnel(pos, songTime * 0.0001);
    // color += showStarTunnel(pos, songTime * 0.0001);

    //Output to screen
    vec3 color = animation(pos, animationId);
    fragColor = vec4(color,1.0);
}
