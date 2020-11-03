#version 300 es

precision highp float;

uniform float width;
uniform float height;

#define PI 3.1415926538

// TODO camelCase to snake_case
uniform float beatProgress;
uniform int beatExists;
uniform int beatIndex;
uniform float songTime;
uniform bool isMobile;
uniform int sectionIndex;
uniform float brightness;

const float intensity = 5.0;
const float radius = 0.008;

#define N_COLORS 5
#define POINT_COUNT 8

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

float ndot(vec2 a, vec2 b ) { return a.x*b.x - a.y*b.y; }

// Copyright © 2018 Inigo Quilez
// The original code is distributed under the MIT license
// Rhombus - exact   (https://www.shadertoy.com/view/XdXcRB)
float sdRhombus( in vec2 p, in vec2 b )
{
    vec2 q = abs(p);
    float h = clamp((-2.0*ndot(q,b)+ndot(b,b))/dot(b,b),-1.0,1.0);
    float d = length( q - 0.5*b*vec2(1.0-h,1.0+h) );
    return d * sign( q.x*b.y + q.y*b.x - b.x*b.y );
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

// https://www.shadertoy.com/view/3s3GDn
float glowMagnitude(float dist, float radius, float intensity) {
    return pow(radius/dist, intensity);
}

float logistic(float t, float alpha, float beta) {
  return 1.0 / (1.0 + exp(-alpha * (t - beta)));
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
  float scale = 1.2;
  float x1 = scale * logistic(t, 10.0, 0.4) - 0.5 * scale;
  float x2 = scale * logistic(t, 10.0, 0.6) - 0.5 * scale;
  return udSegment(pos, vec2(x1, y), vec2(x2, y));
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
  float glow = 10.0 * glowMagnitude(distance_, radius, 8.0);
  return calcColor(distance_, glow, rgb);
}

vec3 showTriangle(vec2 pos, float size, vec3 rgb, float angle) {
  float distance_ = triangle(pos, size, angle);
  float glow = 10.0 * glowMagnitude(distance_, radius, 8.0);
  return calcColor(distance_, glow, rgb);
}

vec3 showRotatedRectangle(vec2 pos, float size, float theta, vec3 rgb) {
  float da = PI / 2.0;
  float angle1 = theta - da;
  float angle2 = theta + da;
  vec2 p1 = vec2(cos(angle1), sin(angle1));
  vec2 p2 = vec2(cos(angle2), sin(angle2));
  float distance_ = rectangle(pos, size * p1, size * p2, 2.0 * size);
  float glow = 2.0 * glowMagnitude(distance_, radius, 4.0);
  return calcColor(distance_, glow, rgb);
}

vec3 showHorizontalBeam(vec2 pos, vec3 color, float y, float time) {
  float distance_ = line(pos, time, y);
  float glow = 1.0 * glowMagnitude(distance_, radius, intensity);
  return calcColor(distance_, glow, color);
}

vec3 showHorizontalBeams(vec2 pos, float y, int beatIndex, float beatProgress) {
  int i = min(3, beatIndex);
  float hue1 = float(i + 0) / float(8);
  vec3 color1 = hsv2rgb(vec3(hue1, 1.0, 1.0));
  float hue2 = float(i + 4) / float(8);
  vec3 color2 = hsv2rgb(vec3(hue2, 1.0, 1.0));
  vec3 color = vec3(0.0);
  color += showHorizontalBeam(pos, color1, +y, beatProgress);
  color += showHorizontalBeam(pos, color2, -y, beatProgress);
  return color;
}

vec3 showStarTunnel(vec2 pos, float time) {
  vec3 crypton_colors[N_COLORS] = getCryptonColors();

  vec3 color = vec3(0.0);

  int n_layers = N_COLORS * 4;
  for (int i = 0; i < n_layers; i++) {
    float g = fract(time + float(i) / float(n_layers));
    vec2 p = (pos + vec2(0.5 * (1.0-g), 0.0)) * mix(100.0, 0.0, g);
    // divide by 5 to rotate 5 star
    float angle = -2.0 * PI * float(i) / (float(n_layers) * 5.0);
    mat2 rotation = mat2(cos(angle), -sin(angle),
		                     sin(angle),  cos(angle));
    p = rotation * p;
    color += showStar(p, g, crypton_colors[i % N_COLORS]);
  }
  return color;
}

vec3 showTriangleTunnel(vec2 pos, float time) {
  vec3 crypton_colors[N_COLORS] = getCryptonColors();

  vec3 color = vec3(0.0);

  int n_layers = N_COLORS * 4;
  for (int i = 0; i < n_layers; i++) {
    float g = fract(time + float(i) / float(n_layers));
    vec2 p = (pos + vec2(0.5 * (1.0-g), 0.0)) * mix(100.0, 0.0, g);
    float angle = -2.0 * PI * float(i) / (float(n_layers) * 3.0);
    color += showTriangle(p, g, crypton_colors[i % N_COLORS], angle);
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

float beamFromCenter(vec2 pos, float r1, float r2, float angle, float beatProgress) {
  float a1 = logistic(beatProgress, 2.0, 0.66);
  float a2 = logistic(beatProgress, 2.0, 0.94);

  vec2 p1 = r1 * vec2(cos(angle), sin(angle));
  vec2 p2 = r2 * vec2(cos(angle), sin(angle));

  vec2 s1 = p1 + a1 * (p2 - p1);
  vec2 s2 = p1 + a2 * (p2 - p1);
  return udSegment(pos, s1, s2);
}

vec3 showBeamsFromCenter(vec2 pos, float r1, float r2, int n, float beatProgress) {
  int i = min(beatIndex, 3);
  vec3 color = vec3(0.0);
  for (int j = 0; j < n; j++) {
    float offset_ = 2.0 * PI * float(j) / float(n);
    float angle = (float(i) / float(4)) * (2.0 * PI / float(n)) + offset_;
    float distance_ = beamFromCenter(pos, r1, r2, angle, beatProgress);
    float glow = 0.004 * glowMagnitude(distance_, radius, 8.0);
    vec3 rgb = hsv2rgb(vec3(float(n * j + i) / float(4 * n), 1.0, 1.0));
    color += calcColor(distance_, glow, rgb);
  }
  return color;
}

float rotatingBeam(vec2 pos, float r1, float r2,
                   float omega, float beam_time) {
  float t1 = omega;
  float t2 = t1;
  vec2 p1 = r1 * vec2(cos(t1), sin(t1));
  vec2 p2 = r2 * vec2(cos(t2), sin(t2));

  float k = fract(beam_time);
  float a1 = logistic(k, 10.0, 0.30);
  float a2 = logistic(k, 10.0, 0.39);
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

vec3 triangleTunnel(vec2 pos) {
  return showTriangleTunnel(pos, songTime * 0.0001);
}

vec3 horizontalBeams(vec2 pos) {
  float center_object_size = getCenterObjectSize();
  vec3 color = vec3(0.0);
  color += showStar(pos, center_object_size, color_rinlen);
  color += showHorizontalBeams(pos, center_object_size + 0.1, beatIndex, beatProgress);
  return color;
}

vec3 beamsFromCenter(vec2 pos) {
  float center_object_size = getCenterObjectSize();
  vec3 color = vec3(0.0);
  color += showStar(pos, center_object_size, color_rinlen);
  color += showBeamsFromCenter(pos, center_object_size, 1.0, 2, beatProgress);
  return color;
}

vec3 animation(vec2 pos, int section) {
  if (section == 0) {
    // intro
    return starWithParticles(pos);
  }

  if (section == 1) {
    // 照らし出してグリーンライツ
    return starWithParticles(pos);
  }

  if (section == 2) {
    // 走り出したキミにもっと
    return triangleTunnel(pos);
  }

  if (section == 2) {
    // 照らし出してグリーンライツ
    return rectangleTunnel(pos);
  }

  if (section == 4) {
    // 今までもいつまでも隣にいたいのは
    return horizontalBeams(pos);
  }

  if (section == 5) {
    // 好きをもっと信じるのさ
    return starTunnel(pos); //
  }

  if (section == 6) {
    // 照らし出してグリーンライツ
    return triangleTunnel(pos);
  }

  if (section == 7) {
    // 堪えきれない夜には隣で泣いていいよ
    return rectangleTunnel(pos);
  }

  if (section == 8) {
    // 走り出したキミにもっと
    return starWithParticles(pos);
  }

  if (section == 9) {
    // 照らし出してグリーンライツ
    return starWithParticles(pos);
  }

  if (section == 10) {
    // 振り返ると遠く手を振ってくれるキミも
    return starWithParticles(pos);
  }

  if (section == 11) {
    // 誰にも真似できないあなたを抱きしめて
    return starWithParticles(pos);
  }

  if (section == 12) {
    // outro
    return starTunnel(pos);
  }

  return vec3(0.0);  // should not reach here
}

void main() {
    vec2 resolution = vec2(width, height);

    vec2 uv = gl_FragCoord.xy/resolution.xy;
    vec2 centre = vec2(0.5, 0.5);
    vec2 pos = uv - centre;
    // scale height to fit the aspect ratio to the canvas
    pos.y *= height / width;

    vec3 color = animation(pos, sectionIndex);
    fragColor = vec4(brightness * color, 1.0);
}
