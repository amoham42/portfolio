uniform vec3 uResolution;
uniform float uTime;
varying vec3 vWorldPos;
varying vec2 vUvVar;

#define rot(a) mat2(cos(a),sin(a),-sin(a),cos(a))
#define pmod(p,x) (mod(p,x)-0.5*(x))

float rand(float a){
    return fract(sin(a*3.0)*944.33)-0.5;
}
vec4 render( in vec2 fragCoord )
{
    vec2 uv = (fragCoord-0.5*uResolution.xy)/uResolution.y;
    float t = floor(uTime*30.0)/30.0;
    //uv = floor(uv*60.0)/60.0;
    
    uv.y+=1.0;
    vec3 purple = vec3(0.271,0.004,0.710);
    vec3 col = purple;
    //col = vec3(0);
    float th = atan(uv.y,uv.x);
    
    //col+=sin(th*3.0)*0.5+0.5;
    //col*=purple;
    vec2 uv2 = uv+1.0;
    vec2 uv3 = uv;
    float aaaa = 0.1;
    uv*=10.0;
    uv = pmod(uv,4.0);
    uv*=rot(t*3.5);
    uv*=rot(-length(uv*5.0));
    
    col+=purple*smoothstep(uv.y-0.1,uv.y+0.4,0.1)*0.5 * step(length(uv),5.5) 
    * pow(clamp((2.5-length(uv)),0.0,1.0),6.0) ;

    col+=0.45*smoothstep(uv.y-0.1,uv.y+0.1,-0.5)*0.9 * step(length(uv),5.5) 
    * max(0.0,(1.4-length(uv))) ;
    uv = uv2;
    
    uv*=10.0;
    uv = pmod(uv,4.0);
    uv*=rot(-t*3.5);
    uv*=rot(length(uv*5.0));
    
    col+=purple*smoothstep(uv.y-0.1,uv.y+0.4,0.1)*0.5 * step(length(uv),5.5) 
    * pow(clamp((2.5-length(uv)),0.0,1.0),6.0) ;
    
    
    col+=0.45*smoothstep(uv.y-0.1,uv.y+0.1,-0.5)*0.9 * step(length(uv),5.5) 
    * max(0.0,(1.4-length(uv))) ;
    
    
    col*=step(abs(uv3.x),0.6);
    col*=1.0+rand(col.x)*0.1+rand(col.y)*0.05;
    
    return vec4(col,1.0);
}
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec4 col = vec4(0);
    float pixel = (uResolution.y/450.0)*12.0;
    fragCoord = floor(fragCoord/pixel)*pixel;
    float scale = 1.0/5.0;

    col =render(fragCoord)*scale;
    fragCoord.x+=8.0;
    col+=render(fragCoord)*scale;
    fragCoord.x-=8.0;
    col+=render(fragCoord)*scale;
    fragCoord.y+=8.0;
    col+=render(fragCoord)*scale;
    fragCoord.y-=8.0;
    col+=render(fragCoord)*scale;

    fragColor = vec4(col);
}

void main() {
    // Map cube UVs (0..1) into pixel space so the shader scales consistently
    vec2 fragCoord = vUvVar * uResolution.xy;

    // Subtle parallax so the effect reacts to camera movement
    vec3 viewDir = normalize(cameraPosition - vWorldPos);
    fragCoord += viewDir.xy * (0.02 * uResolution.y);

    vec4 color = vec4(0.0);
    mainImage(color, fragCoord);
    gl_FragColor = color;
}