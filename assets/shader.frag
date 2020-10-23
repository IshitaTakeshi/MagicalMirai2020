precision highp float;

uniform float width;
uniform float height;
vec2 resolution = vec2(width, height);

#define PI 3.1415926538

uniform float time;

#define POINT_COUNT 4

vec2 points[POINT_COUNT];
const float speed = -0.5;
const float len = 0.25;
float intensity = 1.3;
float radius = 0.008;

//https://www.shadertoy.com/view/MlKcDD
//Signed distance to a quadratic bezier
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


vec2 getHeartPosition(float t){
    float scale = 2.0;
    return vec2(scale * (abs(sin(t)) - 0.5), 0.0);
}

//https://www.shadertoy.com/view/3s3GDn
float getGlow(float dist, float radius, float intensity){
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

float getSegment(float t, vec2 pos) {
    t = fract(t);
    for(int i = 0; i < POINT_COUNT; i++) {
        points[i] = getHeartPosition(float(i) * 0.1 + t * 0.5 * PI);
    }

    return drawSmooth(pos, points);
}

void main(){
    vec2 uv = gl_FragCoord.xy/resolution.xy;
    float widthHeightRatio = resolution.x/resolution.y;
    vec2 centre = vec2(0.5, 0.5);
    vec2 pos = uv - centre;
    //Shift upwards to centre heart
    float scale = 1.0;

    float t = time;

    //Get first segment
    float dist = getSegment(t, pos);
    float glow = getGlow(dist, radius, intensity);

    vec3 color = vec3(0.0);

    //White core
    color += 10.0 * vec3(smoothstep(0.003, 0.001, dist));
    //Pink glow
    color += glow * vec3(1.0,0.05,0.3);

    //Tone mapping
    color = 1.0 - exp(-color);

    //Gamma
    color = pow(color, vec3(0.4545));

    //Output to screen
    gl_FragColor = vec4(color,1.0);
}
