const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./three.webgpu-y7v7QqYq.js","./three.core-BL7ap6q5.js"])))=>i.map(i=>d[i]);
import{c as Ja,N as Zt,S as Oi,V as Tt,C as Ye,F as ca,M as vn,a as Le,R as eo,w as Mi,W as Ji,b as En,d as ft,L as wn,H as ni,U as sn,D as Dt,B as Rt,e as Un,f as ii,p as to,E as no,g as gt,P as Dn,A as io,h as ci,i as Gt,j as Qn,k as Fi,l as In,m as Nn,n as la,o as ro,q as pn,r as Jn,s as ao,t as oo,u as Rn,O as so,v as co,x as lo,y as fo,z as uo,G as po,I as ho,J as mo,K as _o,Q as go,T as vo,X as Eo,Y as So,Z as Mo,_ as To,$ as xo,a0 as Ao,a1 as Ro,a2 as li,a3 as mn,a4 as Wn,a5 as Co,a6 as yn,a7 as bo,a8 as wo,a9 as Po,aa as Lo,ab as fa,ac as Do,ad as yo,ae as Uo,af as Io,ag as ke,ah as No,ai as Oo,aj as Fo,ak as cn,al as Bi,am as Yn,an as We,ao as da,ap as on,aq as Bt,ar as ei,as as ua,at as pa,au as ha,av as ti,aw as Bo,ax as Go,ay as Ho,az as Vo,aA as ma,aB as an,aC as ko,aD as Wo,aE as zo,aF as _a,aG as Xo,aH as ga,aI as va,aJ as fi,aK as di,aL as ui,aM as pi,aN as Qe,aO as er,aP as tr,aQ as nr,aR as ir,aS as rr,aT as ar,aU as or,aV as sr,aW as cr,aX as lr,aY as fr,aZ as dr,a_ as ur,a$ as pr,b0 as hr,b1 as mr,b2 as _r,b3 as gr,b4 as vr,b5 as Er,b6 as Sr,b7 as Mr,b8 as Tr,b9 as xr,ba as Ar,bb as Rr,bc as Cr,bd as br,be as Ti,bf as xi,bg as Ai,bh as Ri,bi as Ci,bj as bi,bk as wi,bl as Ko,bm as wr,bn as Yo,bo as qn,bp as qo,bq as Pr,br as Lr,bs as Ht,bt as Pi,bu as Li,bv as $o,bw as Ea,bx as Zo,by as ri,bz as jo,bA as Qo,bB as Sa,bC as $t,bD as Dr,bE as Gi,bF as yr,bG as Ma,bH as On,bI as Sn,bJ as Jo,bK as Yt,bL as es,bM as ts,bN as ns,bO as Ur,bP as Mt,bQ as is,bR as Ta,bS as rs,bT as as,bU as os,bV as xa,bW as ss,bX as cs,bY as ls,bZ as fs,b_ as ds,b$ as us,c0 as ps,c1 as hs,c2 as ms,c3 as _s,c4 as gs,c5 as vs,c6 as Es,c7 as Ss,c8 as Ms,c9 as Aa,ca as Ot,cb as Ts,cc as _t,cd as xs,ce as Ra,cf as As,cg as Ca,ch as ba,ci as Rs,cj as Ir,ck as hi,cl as Di,cm as Nr,cn as Cs,co as bs,cp as ws,cq as Ps,cr as wa,cs as Pa,ct as Ls,cu as Ds,cv as ys}from"./three.core-BL7ap6q5.js";(function(){const n=document.createElement("link").relList;if(n&&n.supports&&n.supports("modulepreload"))return;for(const o of document.querySelectorAll('link[rel="modulepreload"]'))i(o);new MutationObserver(o=>{for(const r of o)if(r.type==="childList")for(const p of r.addedNodes)p.tagName==="LINK"&&p.rel==="modulepreload"&&i(p)}).observe(document,{childList:!0,subtree:!0});function t(o){const r={};return o.integrity&&(r.integrity=o.integrity),o.referrerPolicy&&(r.referrerPolicy=o.referrerPolicy),o.crossOrigin==="use-credentials"?r.credentials="include":o.crossOrigin==="anonymous"?r.credentials="omit":r.credentials="same-origin",r}function i(o){if(o.ep)return;o.ep=!0;const r=t(o);fetch(o.href,r)}})();const Us="modulepreload",Is=function(e,n){return new URL(e,n).href},Or={},Ns=function(n,t,i){let o=Promise.resolve();if(t&&t.length>0){let M=function(b){return Promise.all(b.map(v=>Promise.resolve(v).then(S=>({status:"fulfilled",value:S}),S=>({status:"rejected",reason:S}))))};const p=document.getElementsByTagName("link"),f=document.querySelector("meta[property=csp-nonce]"),x=f?.nonce||f?.getAttribute("nonce");o=M(t.map(b=>{if(b=Is(b,i),b in Or)return;Or[b]=!0;const v=b.endsWith(".css"),S=v?'[rel="stylesheet"]':"";if(i)for(let B=p.length-1;B>=0;B--){const y=p[B];if(y.href===b&&(!v||y.rel==="stylesheet"))return}else if(document.querySelector(`link[href="${b}"]${S}`))return;const T=document.createElement("link");if(T.rel=v?"stylesheet":Us,v||(T.as="script"),T.crossOrigin="",T.href=b,x&&T.setAttribute("nonce",x),document.head.appendChild(T),v)return new Promise((B,y)=>{T.addEventListener("load",B),T.addEventListener("error",()=>y(new Error(`Unable to preload CSS for ${b}`)))})}))}function r(p){const f=new Event("vite:preloadError",{cancelable:!0});if(f.payload=p,window.dispatchEvent(f),!f.defaultPrevented)throw p}return o.then(p=>{for(const f of p||[])f.status==="rejected"&&r(f.reason);return n().catch(r)})};function La(){let e=null,n=!1,t=null,i=null;function o(r,p){t(r,p),i=e.requestAnimationFrame(o)}return{start:function(){n!==!0&&t!==null&&(i=e.requestAnimationFrame(o),n=!0)},stop:function(){e.cancelAnimationFrame(i),n=!1},setAnimationLoop:function(r){t=r},setContext:function(r){e=r}}}function Os(e){const n=new WeakMap;function t(f,x){const M=f.array,b=f.usage,v=M.byteLength,S=e.createBuffer();e.bindBuffer(x,S),e.bufferData(x,M,b),f.onUploadCallback();let T;if(M instanceof Float32Array)T=e.FLOAT;else if(typeof Float16Array<"u"&&M instanceof Float16Array)T=e.HALF_FLOAT;else if(M instanceof Uint16Array)f.isFloat16BufferAttribute?T=e.HALF_FLOAT:T=e.UNSIGNED_SHORT;else if(M instanceof Int16Array)T=e.SHORT;else if(M instanceof Uint32Array)T=e.UNSIGNED_INT;else if(M instanceof Int32Array)T=e.INT;else if(M instanceof Int8Array)T=e.BYTE;else if(M instanceof Uint8Array)T=e.UNSIGNED_BYTE;else if(M instanceof Uint8ClampedArray)T=e.UNSIGNED_BYTE;else throw new Error("THREE.WebGLAttributes: Unsupported buffer data format: "+M);return{buffer:S,type:T,bytesPerElement:M.BYTES_PER_ELEMENT,version:f.version,size:v}}function i(f,x,M){const b=x.array,v=x.updateRanges;if(e.bindBuffer(M,f),v.length===0)e.bufferSubData(M,0,b);else{v.sort((T,B)=>T.start-B.start);let S=0;for(let T=1;T<v.length;T++){const B=v[S],y=v[T];y.start<=B.start+B.count+1?B.count=Math.max(B.count,y.start+y.count-B.start):(++S,v[S]=y)}v.length=S+1;for(let T=0,B=v.length;T<B;T++){const y=v[T];e.bufferSubData(M,y.start*b.BYTES_PER_ELEMENT,b,y.start,y.count)}x.clearUpdateRanges()}x.onUploadCallback()}function o(f){return f.isInterleavedBufferAttribute&&(f=f.data),n.get(f)}function r(f){f.isInterleavedBufferAttribute&&(f=f.data);const x=n.get(f);x&&(e.deleteBuffer(x.buffer),n.delete(f))}function p(f,x){if(f.isInterleavedBufferAttribute&&(f=f.data),f.isGLBufferAttribute){const b=n.get(f);(!b||b.version<f.version)&&n.set(f,{buffer:f.buffer,type:f.type,bytesPerElement:f.elementSize,version:f.version});return}const M=n.get(f);if(M===void 0)n.set(f,t(f,x));else if(M.version<f.version){if(M.size!==f.array.byteLength)throw new Error("THREE.WebGLAttributes: The size of the buffer attribute's array buffer does not match the original size. Resizing buffer attributes is not supported.");i(M.buffer,f,x),M.version=f.version}}return{get:o,remove:r,update:p}}var Fs=`#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`,Bs=`#ifdef USE_ALPHAHASH
	const float ALPHA_HASH_SCALE = 0.05;
	float hash2D( vec2 value ) {
		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );
	}
	float hash3D( vec3 value ) {
		return hash2D( vec2( hash2D( value.xy ), value.z ) );
	}
	float getAlphaHashThreshold( vec3 position ) {
		float maxDeriv = max(
			length( dFdx( position.xyz ) ),
			length( dFdy( position.xyz ) )
		);
		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );
		vec2 pixScales = vec2(
			exp2( floor( log2( pixScale ) ) ),
			exp2( ceil( log2( pixScale ) ) )
		);
		vec2 alpha = vec2(
			hash3D( floor( pixScales.x * position.xyz ) ),
			hash3D( floor( pixScales.y * position.xyz ) )
		);
		float lerpFactor = fract( log2( pixScale ) );
		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;
		float a = min( lerpFactor, 1.0 - lerpFactor );
		vec3 cases = vec3(
			x * x / ( 2.0 * a * ( 1.0 - a ) ),
			( x - 0.5 * a ) / ( 1.0 - a ),
			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )
		);
		float threshold = ( x < ( 1.0 - a ) )
			? ( ( x < a ) ? cases.x : cases.y )
			: cases.z;
		return clamp( threshold , 1.0e-6, 1.0 );
	}
#endif`,Gs=`#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`,Hs=`#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,Vs=`#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`,ks=`#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`,Ws=`#ifdef USE_AOMAP
	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	#if defined( USE_CLEARCOAT ) 
		clearcoatSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_SHEEN ) 
		sheenSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD )
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
	#endif
#endif`,zs=`#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`,Xs=`#ifdef USE_BATCHING
	#if ! defined( GL_ANGLE_multi_draw )
	#define gl_DrawID _gl_DrawID
	uniform int _gl_DrawID;
	#endif
	uniform highp sampler2D batchingTexture;
	uniform highp usampler2D batchingIdTexture;
	mat4 getBatchingMatrix( const in float i ) {
		int size = textureSize( batchingTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
	float getIndirectIndex( const in int i ) {
		int size = textureSize( batchingIdTexture, 0 ).x;
		int x = i % size;
		int y = i / size;
		return float( texelFetch( batchingIdTexture, ivec2( x, y ), 0 ).r );
	}
#endif
#ifdef USE_BATCHING_COLOR
	uniform sampler2D batchingColorTexture;
	vec3 getBatchingColor( const in float i ) {
		int size = textureSize( batchingColorTexture, 0 ).x;
		int j = int( i );
		int x = j % size;
		int y = j / size;
		return texelFetch( batchingColorTexture, ivec2( x, y ), 0 ).rgb;
	}
#endif`,Ks=`#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`,Ys=`vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`,qs=`vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`,$s=`float G_BlinnPhong_Implicit( ) {
	return 0.25;
}
float D_BlinnPhong( const in float shininess, const in float dotNH ) {
	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );
}
vec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( specularColor, 1.0, dotVH );
	float G = G_BlinnPhong_Implicit( );
	float D = D_BlinnPhong( shininess, dotNH );
	return F * ( G * D );
} // validated`,Zs=`#ifdef USE_IRIDESCENCE
	const mat3 XYZ_TO_REC709 = mat3(
		 3.2404542, -0.9692660,  0.0556434,
		-1.5371385,  1.8760108, -0.2040259,
		-0.4985314,  0.0415560,  1.0572252
	);
	vec3 Fresnel0ToIor( vec3 fresnel0 ) {
		vec3 sqrtF0 = sqrt( fresnel0 );
		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );
	}
	vec3 IorToFresnel0( vec3 transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );
	}
	float IorToFresnel0( float transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ));
	}
	vec3 evalSensitivity( float OPD, vec3 shift ) {
		float phase = 2.0 * PI * OPD * 1.0e-9;
		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );
		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );
		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );
		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - pow2( phase ) * var );
		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * pow2( phase ) );
		xyz /= 1.0685e-7;
		vec3 rgb = XYZ_TO_REC709 * xyz;
		return rgb;
	}
	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {
		vec3 I;
		float iridescenceIOR = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );
		float sinTheta2Sq = pow2( outsideIOR / iridescenceIOR ) * ( 1.0 - pow2( cosTheta1 ) );
		float cosTheta2Sq = 1.0 - sinTheta2Sq;
		if ( cosTheta2Sq < 0.0 ) {
			return vec3( 1.0 );
		}
		float cosTheta2 = sqrt( cosTheta2Sq );
		float R0 = IorToFresnel0( iridescenceIOR, outsideIOR );
		float R12 = F_Schlick( R0, 1.0, cosTheta1 );
		float T121 = 1.0 - R12;
		float phi12 = 0.0;
		if ( iridescenceIOR < outsideIOR ) phi12 = PI;
		float phi21 = PI - phi12;
		vec3 baseIOR = Fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) );		vec3 R1 = IorToFresnel0( baseIOR, iridescenceIOR );
		vec3 R23 = F_Schlick( R1, 1.0, cosTheta2 );
		vec3 phi23 = vec3( 0.0 );
		if ( baseIOR[ 0 ] < iridescenceIOR ) phi23[ 0 ] = PI;
		if ( baseIOR[ 1 ] < iridescenceIOR ) phi23[ 1 ] = PI;
		if ( baseIOR[ 2 ] < iridescenceIOR ) phi23[ 2 ] = PI;
		float OPD = 2.0 * iridescenceIOR * thinFilmThickness * cosTheta2;
		vec3 phi = vec3( phi21 ) + phi23;
		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );
		vec3 r123 = sqrt( R123 );
		vec3 Rs = pow2( T121 ) * R23 / ( vec3( 1.0 ) - R123 );
		vec3 C0 = R12 + Rs;
		I = C0;
		vec3 Cm = Rs - T121;
		for ( int m = 1; m <= 2; ++ m ) {
			Cm *= r123;
			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );
			I += Cm * Sm;
		}
		return max( I, vec3( 0.0 ) );
	}
#endif`,js=`#ifdef USE_BUMPMAP
	uniform sampler2D bumpMap;
	uniform float bumpScale;
	vec2 dHdxy_fwd() {
		vec2 dSTdx = dFdx( vBumpMapUv );
		vec2 dSTdy = dFdy( vBumpMapUv );
		float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;
		float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;
		float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;
		return vec2( dBx, dBy );
	}
	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );
		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );
		vec3 vN = surf_norm;
		vec3 R1 = cross( vSigmaY, vN );
		vec3 R2 = cross( vN, vSigmaX );
		float fDet = dot( vSigmaX, R1 ) * faceDirection;
		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
		return normalize( abs( fDet ) * surf_norm - vGrad );
	}
#endif`,Qs=`#if NUM_CLIPPING_PLANES > 0
	vec4 plane;
	#ifdef ALPHA_TO_COVERAGE
		float distanceToPlane, distanceGradient;
		float clipOpacity = 1.0;
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
			distanceGradient = fwidth( distanceToPlane ) / 2.0;
			clipOpacity *= smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			if ( clipOpacity == 0.0 ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			float unionClipOpacity = 1.0;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
				distanceGradient = fwidth( distanceToPlane ) / 2.0;
				unionClipOpacity *= 1.0 - smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			}
			#pragma unroll_loop_end
			clipOpacity *= 1.0 - unionClipOpacity;
		#endif
		diffuseColor.a *= clipOpacity;
		if ( diffuseColor.a == 0.0 ) discard;
	#else
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			bool clipped = true;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;
			}
			#pragma unroll_loop_end
			if ( clipped ) discard;
		#endif
	#endif
#endif`,Js=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`,ec=`#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`,tc=`#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`,nc=`#if defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#elif defined( USE_COLOR )
	diffuseColor.rgb *= vColor;
#endif`,ic=`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR )
	varying vec3 vColor;
#endif`,rc=`#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec3 vColor;
#endif`,ac=`#if defined( USE_COLOR_ALPHA )
	vColor = vec4( 1.0 );
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	vColor = vec3( 1.0 );
#endif
#ifdef USE_COLOR
	vColor *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.xyz *= instanceColor.xyz;
#endif
#ifdef USE_BATCHING_COLOR
	vec3 batchingColor = getBatchingColor( getIndirectIndex( gl_DrawID ) );
	vColor.xyz *= batchingColor.xyz;
#endif`,oc=`#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement( a ) ( 1.0 - saturate( a ) )
float pow2( const in float x ) { return x*x; }
vec3 pow2( const in vec3 x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }
float average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }
highp float rand( const in vec2 uv ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract( sin( sn ) * c );
}
#ifdef HIGH_PRECISION
	float precisionSafeLength( vec3 v ) { return length( v ); }
#else
	float precisionSafeLength( vec3 v ) {
		float maxComponent = max3( abs( v ) );
		return length( v / maxComponent ) * maxComponent;
	}
#endif
struct IncidentLight {
	vec3 color;
	vec3 direction;
	bool visible;
};
struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};
#ifdef USE_ALPHAHASH
	varying vec3 vPosition;
#endif
vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
}
vec3 inverseTransformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( vec4( dir, 0.0 ) * matrix ).xyz );
}
mat3 transposeMat3( const in mat3 m ) {
	mat3 tmp;
	tmp[ 0 ] = vec3( m[ 0 ].x, m[ 1 ].x, m[ 2 ].x );
	tmp[ 1 ] = vec3( m[ 0 ].y, m[ 1 ].y, m[ 2 ].y );
	tmp[ 2 ] = vec3( m[ 0 ].z, m[ 1 ].z, m[ 2 ].z );
	return tmp;
}
bool isPerspectiveMatrix( mat4 m ) {
	return m[ 2 ][ 3 ] == - 1.0;
}
vec2 equirectUv( in vec3 dir ) {
	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
	return vec2( u, v );
}
vec3 BRDF_Lambert( const in vec3 diffuseColor ) {
	return RECIPROCAL_PI * diffuseColor;
}
vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}
float F_Schlick( const in float f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
} // validated`,sc=`#ifdef ENVMAP_TYPE_CUBE_UV
	#define cubeUV_minMipLevel 4.0
	#define cubeUV_minTileSize 16.0
	float getFace( vec3 direction ) {
		vec3 absDirection = abs( direction );
		float face = - 1.0;
		if ( absDirection.x > absDirection.z ) {
			if ( absDirection.x > absDirection.y )
				face = direction.x > 0.0 ? 0.0 : 3.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		} else {
			if ( absDirection.z > absDirection.y )
				face = direction.z > 0.0 ? 2.0 : 5.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		}
		return face;
	}
	vec2 getUV( vec3 direction, float face ) {
		vec2 uv;
		if ( face == 0.0 ) {
			uv = vec2( direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 1.0 ) {
			uv = vec2( - direction.x, - direction.z ) / abs( direction.y );
		} else if ( face == 2.0 ) {
			uv = vec2( - direction.x, direction.y ) / abs( direction.z );
		} else if ( face == 3.0 ) {
			uv = vec2( - direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 4.0 ) {
			uv = vec2( - direction.x, direction.z ) / abs( direction.y );
		} else {
			uv = vec2( direction.x, direction.y ) / abs( direction.z );
		}
		return 0.5 * ( uv + 1.0 );
	}
	vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {
		float face = getFace( direction );
		float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );
		mipInt = max( mipInt, cubeUV_minMipLevel );
		float faceSize = exp2( mipInt );
		highp vec2 uv = getUV( direction, face ) * ( faceSize - 2.0 ) + 1.0;
		if ( face > 2.0 ) {
			uv.y += faceSize;
			face -= 3.0;
		}
		uv.x += face * faceSize;
		uv.x += filterInt * 3.0 * cubeUV_minTileSize;
		uv.y += 4.0 * ( exp2( CUBEUV_MAX_MIP ) - faceSize );
		uv.x *= CUBEUV_TEXEL_WIDTH;
		uv.y *= CUBEUV_TEXEL_HEIGHT;
		#ifdef texture2DGradEXT
			return texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) ).rgb;
		#else
			return texture2D( envMap, uv ).rgb;
		#endif
	}
	#define cubeUV_r0 1.0
	#define cubeUV_m0 - 2.0
	#define cubeUV_r1 0.8
	#define cubeUV_m1 - 1.0
	#define cubeUV_r4 0.4
	#define cubeUV_m4 2.0
	#define cubeUV_r5 0.305
	#define cubeUV_m5 3.0
	#define cubeUV_r6 0.21
	#define cubeUV_m6 4.0
	float roughnessToMip( float roughness ) {
		float mip = 0.0;
		if ( roughness >= cubeUV_r1 ) {
			mip = ( cubeUV_r0 - roughness ) * ( cubeUV_m1 - cubeUV_m0 ) / ( cubeUV_r0 - cubeUV_r1 ) + cubeUV_m0;
		} else if ( roughness >= cubeUV_r4 ) {
			mip = ( cubeUV_r1 - roughness ) * ( cubeUV_m4 - cubeUV_m1 ) / ( cubeUV_r1 - cubeUV_r4 ) + cubeUV_m1;
		} else if ( roughness >= cubeUV_r5 ) {
			mip = ( cubeUV_r4 - roughness ) * ( cubeUV_m5 - cubeUV_m4 ) / ( cubeUV_r4 - cubeUV_r5 ) + cubeUV_m4;
		} else if ( roughness >= cubeUV_r6 ) {
			mip = ( cubeUV_r5 - roughness ) * ( cubeUV_m6 - cubeUV_m5 ) / ( cubeUV_r5 - cubeUV_r6 ) + cubeUV_m5;
		} else {
			mip = - 2.0 * log2( 1.16 * roughness );		}
		return mip;
	}
	vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {
		float mip = clamp( roughnessToMip( roughness ), cubeUV_m0, CUBEUV_MAX_MIP );
		float mipF = fract( mip );
		float mipInt = floor( mip );
		vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );
		if ( mipF == 0.0 ) {
			return vec4( color0, 1.0 );
		} else {
			vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );
			return vec4( mix( color0, color1, mipF ), 1.0 );
		}
	}
#endif`,cc=`vec3 transformedNormal = objectNormal;
#ifdef USE_TANGENT
	vec3 transformedTangent = objectTangent;
#endif
#ifdef USE_BATCHING
	mat3 bm = mat3( batchingMatrix );
	transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );
	transformedNormal = bm * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = bm * transformedTangent;
	#endif
#endif
#ifdef USE_INSTANCING
	mat3 im = mat3( instanceMatrix );
	transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );
	transformedNormal = im * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = im * transformedTangent;
	#endif
#endif
transformedNormal = normalMatrix * transformedNormal;
#ifdef FLIP_SIDED
	transformedNormal = - transformedNormal;
#endif
#ifdef USE_TANGENT
	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;
	#ifdef FLIP_SIDED
		transformedTangent = - transformedTangent;
	#endif
#endif`,lc=`#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`,fc=`#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`,dc=`#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`,uc=`#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`,pc="gl_FragColor = linearToOutputTexel( gl_FragColor );",hc=`vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`,mc=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( isOrthographic ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
		#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
		#endif
	#else
		vec3 reflectVec = vReflect;
	#endif
	#ifdef ENVMAP_TYPE_CUBE
		vec4 envColor = textureCube( envMap, envMapRotation * vec3( flipEnvMap * reflectVec.x, reflectVec.yz ) );
	#else
		vec4 envColor = vec4( 0.0 );
	#endif
	#ifdef ENVMAP_BLENDING_MULTIPLY
		outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
	#elif defined( ENVMAP_BLENDING_MIX )
		outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
	#elif defined( ENVMAP_BLENDING_ADD )
		outgoingLight += envColor.xyz * specularStrength * reflectivity;
	#endif
#endif`,_c=`#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform float flipEnvMap;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
	
#endif`,gc=`#ifdef USE_ENVMAP
	uniform float reflectivity;
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		varying vec3 vWorldPosition;
		uniform float refractionRatio;
	#else
		varying vec3 vReflect;
	#endif
#endif`,vc=`#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`,Ec=`#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vWorldPosition = worldPosition.xyz;
	#else
		vec3 cameraToVertex;
		if ( isOrthographic ) {
			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vReflect = reflect( cameraToVertex, worldNormal );
		#else
			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
		#endif
	#endif
#endif`,Sc=`#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`,Mc=`#ifdef USE_FOG
	varying float vFogDepth;
#endif`,Tc=`#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`,xc=`#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`,Ac=`#ifdef USE_GRADIENTMAP
	uniform sampler2D gradientMap;
#endif
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
	float dotNL = dot( normal, lightDirection );
	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );
	#ifdef USE_GRADIENTMAP
		return vec3( texture2D( gradientMap, coord ).r );
	#else
		vec2 fw = fwidth( coord ) * 0.5;
		return mix( vec3( 0.7 ), vec3( 1.0 ), smoothstep( 0.7 - fw.x, 0.7 + fw.x, coord.x ) );
	#endif
}`,Rc=`#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`,Cc=`LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`,bc=`varying vec3 vViewPosition;
struct LambertMaterial {
	vec3 diffuseColor;
	float specularStrength;
};
void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Lambert
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`,wc=`uniform bool receiveShadow;
uniform vec3 ambientLightColor;
#if defined( USE_LIGHT_PROBES )
	uniform vec3 lightProbe[ 9 ];
#endif
vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {
	float x = normal.x, y = normal.y, z = normal.z;
	vec3 result = shCoefficients[ 0 ] * 0.886227;
	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;
	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );
	return result;
}
vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {
	vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );
	return irradiance;
}
vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
	vec3 irradiance = ambientLightColor;
	return irradiance;
}
float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
	float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
	if ( cutoffDistance > 0.0 ) {
		distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
	}
	return distanceFalloff;
}
float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {
	return smoothstep( coneCosine, penumbraCosine, angleCosine );
}
#if NUM_DIR_LIGHTS > 0
	struct DirectionalLight {
		vec3 direction;
		vec3 color;
	};
	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {
		light.color = directionalLight.color;
		light.direction = directionalLight.direction;
		light.visible = true;
	}
#endif
#if NUM_POINT_LIGHTS > 0
	struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;
	};
	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
	void getPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = pointLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float lightDistance = length( lVector );
		light.color = pointLight.color;
		light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
		light.visible = ( light.color != vec3( 0.0 ) );
	}
#endif
#if NUM_SPOT_LIGHTS > 0
	struct SpotLight {
		vec3 position;
		vec3 direction;
		vec3 color;
		float distance;
		float decay;
		float coneCos;
		float penumbraCos;
	};
	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];
	void getSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = spotLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float angleCos = dot( light.direction, spotLight.direction );
		float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );
		if ( spotAttenuation > 0.0 ) {
			float lightDistance = length( lVector );
			light.color = spotLight.color * spotAttenuation;
			light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );
			light.visible = ( light.color != vec3( 0.0 ) );
		} else {
			light.color = vec3( 0.0 );
			light.visible = false;
		}
	}
#endif
#if NUM_RECT_AREA_LIGHTS > 0
	struct RectAreaLight {
		vec3 color;
		vec3 position;
		vec3 halfWidth;
		vec3 halfHeight;
	};
	uniform sampler2D ltc_1;	uniform sampler2D ltc_2;
	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];
#endif
#if NUM_HEMI_LIGHTS > 0
	struct HemisphereLight {
		vec3 direction;
		vec3 skyColor;
		vec3 groundColor;
	};
	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];
	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {
		float dotNL = dot( normal, hemiLight.direction );
		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;
		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );
		return irradiance;
	}
#endif`,Pc=`#ifdef USE_ENVMAP
	vec3 getIBLIrradiance( const in vec3 normal ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 );
			return PI * envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 reflectVec = reflect( - viewDir, normal );
			reflectVec = normalize( mix( reflectVec, normal, roughness * roughness) );
			reflectVec = inverseTransformDirection( reflectVec, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, roughness );
			return envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	#ifdef USE_ANISOTROPY
		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 bentNormal = cross( bitangent, viewDir );
				bentNormal = normalize( cross( bentNormal, bitangent ) );
				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
				return getIBLRadiance( viewDir, bentNormal, roughness );
			#else
				return vec3( 0.0 );
			#endif
		}
	#endif
#endif`,Lc=`ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`,Dc=`varying vec3 vViewPosition;
struct ToonMaterial {
	vec3 diffuseColor;
};
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Toon
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`,yc=`BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`,Uc=`varying vec3 vViewPosition;
struct BlinnPhongMaterial {
	vec3 diffuseColor;
	vec3 specularColor;
	float specularShininess;
	float specularStrength;
};
void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
	reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;
}
void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`,Ic=`PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb * ( 1.0 - metalnessFactor );
vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );
float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
material.roughness = max( roughnessFactor, 0.0525 );material.roughness += geometryRoughness;
material.roughness = min( material.roughness, 1.0 );
#ifdef IOR
	material.ior = ior;
	#ifdef USE_SPECULAR
		float specularIntensityFactor = specularIntensity;
		vec3 specularColorFactor = specularColor;
		#ifdef USE_SPECULAR_COLORMAP
			specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;
		#endif
		#ifdef USE_SPECULAR_INTENSITYMAP
			specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;
		#endif
		material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );
	#else
		float specularIntensityFactor = 1.0;
		vec3 specularColorFactor = vec3( 1.0 );
		material.specularF90 = 1.0;
	#endif
	material.specularColor = mix( min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor, diffuseColor.rgb, metalnessFactor );
#else
	material.specularColor = mix( vec3( 0.04 ), diffuseColor.rgb, metalnessFactor );
	material.specularF90 = 1.0;
#endif
#ifdef USE_CLEARCOAT
	material.clearcoat = clearcoat;
	material.clearcoatRoughness = clearcoatRoughness;
	material.clearcoatF0 = vec3( 0.04 );
	material.clearcoatF90 = 1.0;
	#ifdef USE_CLEARCOATMAP
		material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;
	#endif
	#ifdef USE_CLEARCOAT_ROUGHNESSMAP
		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;
	#endif
	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );
	material.clearcoatRoughness += geometryRoughness;
	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );
#endif
#ifdef USE_DISPERSION
	material.dispersion = dispersion;
#endif
#ifdef USE_IRIDESCENCE
	material.iridescence = iridescence;
	material.iridescenceIOR = iridescenceIOR;
	#ifdef USE_IRIDESCENCEMAP
		material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;
	#endif
	#ifdef USE_IRIDESCENCE_THICKNESSMAP
		material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;
	#else
		material.iridescenceThickness = iridescenceThicknessMaximum;
	#endif
#endif
#ifdef USE_SHEEN
	material.sheenColor = sheenColor;
	#ifdef USE_SHEEN_COLORMAP
		material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;
	#endif
	material.sheenRoughness = clamp( sheenRoughness, 0.07, 1.0 );
	#ifdef USE_SHEEN_ROUGHNESSMAP
		material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;
	#endif
#endif
#ifdef USE_ANISOTROPY
	#ifdef USE_ANISOTROPYMAP
		mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );
		vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;
		vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;
	#else
		vec2 anisotropyV = anisotropyVector;
	#endif
	material.anisotropy = length( anisotropyV );
	if( material.anisotropy == 0.0 ) {
		anisotropyV = vec2( 1.0, 0.0 );
	} else {
		anisotropyV /= material.anisotropy;
		material.anisotropy = saturate( material.anisotropy );
	}
	material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );
	material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;
	material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;
#endif`,Nc=`struct PhysicalMaterial {
	vec3 diffuseColor;
	float roughness;
	vec3 specularColor;
	float specularF90;
	float dispersion;
	#ifdef USE_CLEARCOAT
		float clearcoat;
		float clearcoatRoughness;
		vec3 clearcoatF0;
		float clearcoatF90;
	#endif
	#ifdef USE_IRIDESCENCE
		float iridescence;
		float iridescenceIOR;
		float iridescenceThickness;
		vec3 iridescenceFresnel;
		vec3 iridescenceF0;
	#endif
	#ifdef USE_SHEEN
		vec3 sheenColor;
		float sheenRoughness;
	#endif
	#ifdef IOR
		float ior;
	#endif
	#ifdef USE_TRANSMISSION
		float transmission;
		float transmissionAlpha;
		float thickness;
		float attenuationDistance;
		vec3 attenuationColor;
	#endif
	#ifdef USE_ANISOTROPY
		float anisotropy;
		float alphaT;
		vec3 anisotropyT;
		vec3 anisotropyB;
	#endif
};
vec3 clearcoatSpecularDirect = vec3( 0.0 );
vec3 clearcoatSpecularIndirect = vec3( 0.0 );
vec3 sheenSpecularDirect = vec3( 0.0 );
vec3 sheenSpecularIndirect = vec3(0.0 );
vec3 Schlick_to_F0( const in vec3 f, const in float f90, const in float dotVH ) {
    float x = clamp( 1.0 - dotVH, 0.0, 1.0 );
    float x2 = x * x;
    float x5 = clamp( x * x2 * x2, 0.0, 0.9999 );
    return ( f - vec3( f90 ) * x5 ) / ( 1.0 - x5 );
}
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
	float a2 = pow2( alpha );
	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	return 0.5 / max( gv + gl, EPSILON );
}
float D_GGX( const in float alpha, const in float dotNH ) {
	float a2 = pow2( alpha );
	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
	return RECIPROCAL_PI * a2 / pow2( denom );
}
#ifdef USE_ANISOTROPY
	float V_GGX_SmithCorrelated_Anisotropic( const in float alphaT, const in float alphaB, const in float dotTV, const in float dotBV, const in float dotTL, const in float dotBL, const in float dotNV, const in float dotNL ) {
		float gv = dotNL * length( vec3( alphaT * dotTV, alphaB * dotBV, dotNV ) );
		float gl = dotNV * length( vec3( alphaT * dotTL, alphaB * dotBL, dotNL ) );
		float v = 0.5 / ( gv + gl );
		return saturate(v);
	}
	float D_GGX_Anisotropic( const in float alphaT, const in float alphaB, const in float dotNH, const in float dotTH, const in float dotBH ) {
		float a2 = alphaT * alphaB;
		highp vec3 v = vec3( alphaB * dotTH, alphaT * dotBH, a2 * dotNH );
		highp float v2 = dot( v, v );
		float w2 = a2 / v2;
		return RECIPROCAL_PI * a2 * pow2 ( w2 );
	}
#endif
#ifdef USE_CLEARCOAT
	vec3 BRDF_GGX_Clearcoat( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {
		vec3 f0 = material.clearcoatF0;
		float f90 = material.clearcoatF90;
		float roughness = material.clearcoatRoughness;
		float alpha = pow2( roughness );
		vec3 halfDir = normalize( lightDir + viewDir );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float dotNH = saturate( dot( normal, halfDir ) );
		float dotVH = saturate( dot( viewDir, halfDir ) );
		vec3 F = F_Schlick( f0, f90, dotVH );
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
		return F * ( V * D );
	}
#endif
vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 f0 = material.specularColor;
	float f90 = material.specularF90;
	float roughness = material.roughness;
	float alpha = pow2( roughness );
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( f0, f90, dotVH );
	#ifdef USE_IRIDESCENCE
		F = mix( F, material.iridescenceFresnel, material.iridescence );
	#endif
	#ifdef USE_ANISOTROPY
		float dotTL = dot( material.anisotropyT, lightDir );
		float dotTV = dot( material.anisotropyT, viewDir );
		float dotTH = dot( material.anisotropyT, halfDir );
		float dotBL = dot( material.anisotropyB, lightDir );
		float dotBV = dot( material.anisotropyB, viewDir );
		float dotBH = dot( material.anisotropyB, halfDir );
		float V = V_GGX_SmithCorrelated_Anisotropic( material.alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );
		float D = D_GGX_Anisotropic( material.alphaT, alpha, dotNH, dotTH, dotBH );
	#else
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
	#endif
	return F * ( V * D );
}
vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {
	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;
	float dotNV = saturate( dot( N, V ) );
	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );
	uv = uv * LUT_SCALE + LUT_BIAS;
	return uv;
}
float LTC_ClippedSphereFormFactor( const in vec3 f ) {
	float l = length( f );
	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );
}
vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {
	float x = dot( v1, v2 );
	float y = abs( x );
	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
	float b = 3.4175940 + ( 4.1616724 + y ) * y;
	float v = a / b;
	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;
	return cross( v1, v2 ) * theta_sintheta;
}
vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {
	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];
	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];
	vec3 lightNormal = cross( v1, v2 );
	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );
	vec3 T1, T2;
	T1 = normalize( V - N * dot( V, N ) );
	T2 = - cross( N, T1 );
	mat3 mat = mInv * transposeMat3( mat3( T1, T2, N ) );
	vec3 coords[ 4 ];
	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );
	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );
	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );
	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );
	coords[ 0 ] = normalize( coords[ 0 ] );
	coords[ 1 ] = normalize( coords[ 1 ] );
	coords[ 2 ] = normalize( coords[ 2 ] );
	coords[ 3 ] = normalize( coords[ 3 ] );
	vec3 vectorFormFactor = vec3( 0.0 );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );
	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );
	return vec3( result );
}
#if defined( USE_SHEEN )
float D_Charlie( float roughness, float dotNH ) {
	float alpha = pow2( roughness );
	float invAlpha = 1.0 / alpha;
	float cos2h = dotNH * dotNH;
	float sin2h = max( 1.0 - cos2h, 0.0078125 );
	return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );
}
float V_Neubelt( float dotNV, float dotNL ) {
	return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );
}
vec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float D = D_Charlie( sheenRoughness, dotNH );
	float V = V_Neubelt( dotNV, dotNL );
	return sheenColor * ( D * V );
}
#endif
float IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	float r2 = roughness * roughness;
	float a = roughness < 0.25 ? -339.2 * r2 + 161.4 * roughness - 25.9 : -8.48 * r2 + 14.3 * roughness - 9.95;
	float b = roughness < 0.25 ? 44.0 * r2 - 23.7 * roughness + 3.26 : 1.97 * r2 - 3.27 * roughness + 0.72;
	float DG = exp( a * dotNV + b ) + ( roughness < 0.25 ? 0.0 : 0.1 * ( roughness - 0.25 ) );
	return saturate( DG * RECIPROCAL_PI );
}
vec2 DFGApprox( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	const vec4 c0 = vec4( - 1, - 0.0275, - 0.572, 0.022 );
	const vec4 c1 = vec4( 1, 0.0425, 1.04, - 0.04 );
	vec4 r = roughness * c0 + c1;
	float a004 = min( r.x * r.x, exp2( - 9.28 * dotNV ) ) * r.x + r.y;
	vec2 fab = vec2( - 1.04, 1.04 ) * a004 + r.zw;
	return fab;
}
vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {
	vec2 fab = DFGApprox( normal, viewDir, roughness );
	return specularColor * fab.x + specularF90 * fab.y;
}
#ifdef USE_IRIDESCENCE
void computeMultiscatteringIridescence( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif
	vec2 fab = DFGApprox( normal, viewDir, roughness );
	#ifdef USE_IRIDESCENCE
		vec3 Fr = mix( specularColor, iridescenceF0, iridescence );
	#else
		vec3 Fr = specularColor;
	#endif
	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;
	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;
	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619;	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
	singleScatter += FssEss;
	multiScatter += Fms * Ems;
}
#if NUM_RECT_AREA_LIGHTS > 0
	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
		vec3 normal = geometryNormal;
		vec3 viewDir = geometryViewDir;
		vec3 position = geometryPosition;
		vec3 lightPos = rectAreaLight.position;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 lightColor = rectAreaLight.color;
		float roughness = material.roughness;
		vec3 rectCoords[ 4 ];
		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;
		vec2 uv = LTC_Uv( normal, viewDir, roughness );
		vec4 t1 = texture2D( ltc_1, uv );
		vec4 t2 = texture2D( ltc_2, uv );
		mat3 mInv = mat3(
			vec3( t1.x, 0, t1.y ),
			vec3(    0, 1,    0 ),
			vec3( t1.z, 0, t1.w )
		);
		vec3 fresnel = ( material.specularColor * t2.x + ( vec3( 1.0 ) - material.specularColor ) * t2.y );
		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );
		reflectedLight.directDiffuse += lightColor * material.diffuseColor * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );
	}
#endif
void RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	#ifdef USE_CLEARCOAT
		float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );
		vec3 ccIrradiance = dotNLcc * directLight.color;
		clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );
	#endif
	reflectedLight.directSpecular += irradiance * BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	#ifdef USE_CLEARCOAT
		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
	#endif
	vec3 singleScattering = vec3( 0.0 );
	vec3 multiScattering = vec3( 0.0 );
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.iridescence, material.iridescenceFresnel, material.roughness, singleScattering, multiScattering );
	#else
		computeMultiscattering( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.roughness, singleScattering, multiScattering );
	#endif
	vec3 totalScattering = singleScattering + multiScattering;
	vec3 diffuse = material.diffuseColor * ( 1.0 - max( max( totalScattering.r, totalScattering.g ), totalScattering.b ) );
	reflectedLight.indirectSpecular += radiance * singleScattering;
	reflectedLight.indirectSpecular += multiScattering * cosineWeightedIrradiance;
	reflectedLight.indirectDiffuse += diffuse * cosineWeightedIrradiance;
}
#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}`,Oc=`
vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
vec3 geometryClearcoatNormal = vec3( 0.0 );
#ifdef USE_CLEARCOAT
	geometryClearcoatNormal = clearcoatNormal;
#endif
#ifdef USE_IRIDESCENCE
	float dotNVi = saturate( dot( normal, geometryViewDir ) );
	if ( material.iridescenceThickness == 0.0 ) {
		material.iridescence = 0.0;
	} else {
		material.iridescence = saturate( material.iridescence );
	}
	if ( material.iridescence > 0.0 ) {
		material.iridescenceFresnel = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
		material.iridescenceF0 = Schlick_to_F0( material.iridescenceFresnel, 1.0, dotNVi );
	}
#endif
IncidentLight directLight;
#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
	PointLight pointLight;
	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
		pointLight = pointLights[ i ];
		getPointLightInfo( pointLight, geometryPosition, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )
	SpotLight spotLight;
	vec4 spotColor;
	vec3 spotLightCoord;
	bool inSpotLightMap;
	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
		spotLight = spotLights[ i ];
		getSpotLightInfo( spotLight, geometryPosition, directLight );
		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX
		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS
		#else
		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#endif
		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )
			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;
			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );
			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );
			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;
		#endif
		#undef SPOT_LIGHT_MAP_INDEX
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		directionalLight = directionalLights[ i ];
		getDirectionalLightInfo( directionalLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
	RectAreaLight rectAreaLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if defined( RE_IndirectDiffuse )
	vec3 iblIrradiance = vec3( 0.0 );
	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
	#if defined( USE_LIGHT_PROBES )
		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );
	#endif
	#if ( NUM_HEMI_LIGHTS > 0 )
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );
		}
		#pragma unroll_loop_end
	#endif
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif`,Fc=`#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
		irradiance += lightMapIrradiance;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD ) && defined( ENVMAP_TYPE_CUBE_UV )
		iblIrradiance += getIBLIrradiance( geometryNormal );
	#endif
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
	#ifdef USE_ANISOTROPY
		radiance += getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
	#else
		radiance += getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );
	#endif
	#ifdef USE_CLEARCOAT
		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );
	#endif
#endif`,Bc=`#if defined( RE_IndirectDiffuse )
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`,Gc=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`,Hc=`#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,Vc=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`,kc=`#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`,Wc=`#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`,zc=`#ifdef USE_MAP
	uniform sampler2D map;
#endif`,Xc=`#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	#if defined( USE_POINTS_UV )
		vec2 uv = vUv;
	#else
		vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;
	#endif
#endif
#ifdef USE_MAP
	diffuseColor *= texture2D( map, uv );
#endif
#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, uv ).g;
#endif`,Kc=`#if defined( USE_POINTS_UV )
	varying vec2 vUv;
#else
	#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
		uniform mat3 uvTransform;
	#endif
#endif
#ifdef USE_MAP
	uniform sampler2D map;
#endif
#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`,Yc=`float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`,qc=`#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`,$c=`#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`,Zc=`#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`,jc=`#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,Qc=`#ifdef USE_MORPHTARGETS
	#ifndef USE_INSTANCING_MORPH
		uniform float morphTargetBaseInfluence;
		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	#endif
	uniform sampler2DArray morphTargetsTexture;
	uniform ivec2 morphTargetsTextureSize;
	vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {
		int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;
		int y = texelIndex / morphTargetsTextureSize.x;
		int x = texelIndex - y * morphTargetsTextureSize.x;
		ivec3 morphUV = ivec3( x, y, morphTargetIndex );
		return texelFetch( morphTargetsTexture, morphUV, 0 );
	}
#endif`,Jc=`#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`,el=`float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
#ifdef FLAT_SHADED
	vec3 fdx = dFdx( vViewPosition );
	vec3 fdy = dFdy( vViewPosition );
	vec3 normal = normalize( cross( fdx, fdy ) );
#else
	vec3 normal = normalize( vNormal );
	#ifdef DOUBLE_SIDED
		normal *= faceDirection;
	#endif
#endif
#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY )
	#ifdef USE_TANGENT
		mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn = getTangentFrame( - vViewPosition, normal,
		#if defined( USE_NORMALMAP )
			vNormalMapUv
		#elif defined( USE_CLEARCOAT_NORMALMAP )
			vClearcoatNormalMapUv
		#else
			vUv
		#endif
		);
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn[0] *= faceDirection;
		tbn[1] *= faceDirection;
	#endif
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	#ifdef USE_TANGENT
		mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn2[0] *= faceDirection;
		tbn2[1] *= faceDirection;
	#endif
#endif
vec3 nonPerturbedNormal = normal;`,tl=`#ifdef USE_NORMALMAP_OBJECTSPACE
	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#ifdef FLIP_SIDED
		normal = - normal;
	#endif
	#ifdef DOUBLE_SIDED
		normal = normal * faceDirection;
	#endif
	normal = normalize( normalMatrix * normal );
#elif defined( USE_NORMALMAP_TANGENTSPACE )
	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	mapN.xy *= normalScale;
	normal = normalize( tbn * mapN );
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`,nl=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,il=`#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`,rl=`#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
	#endif
#endif`,al=`#ifdef USE_NORMALMAP
	uniform sampler2D normalMap;
	uniform vec2 normalScale;
#endif
#ifdef USE_NORMALMAP_OBJECTSPACE
	uniform mat3 normalMatrix;
#endif
#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY ) )
	mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {
		vec3 q0 = dFdx( eye_pos.xyz );
		vec3 q1 = dFdy( eye_pos.xyz );
		vec2 st0 = dFdx( uv.st );
		vec2 st1 = dFdy( uv.st );
		vec3 N = surf_norm;
		vec3 q1perp = cross( q1, N );
		vec3 q0perp = cross( N, q0 );
		vec3 T = q1perp * st0.x + q0perp * st1.x;
		vec3 B = q1perp * st0.y + q0perp * st1.y;
		float det = max( dot( T, T ), dot( B, B ) );
		float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );
		return mat3( T * scale, B * scale, N );
	}
#endif`,ol=`#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`,sl=`#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`,cl=`#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`,ll=`#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`,fl=`#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`,dl=`vec3 packNormalToRGB( const in vec3 normal ) {
	return normalize( normal ) * 0.5 + 0.5;
}
vec3 unpackRGBToNormal( const in vec3 rgb ) {
	return 2.0 * rgb.xyz - 1.0;
}
const float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;const float ShiftRight8 = 1. / 256.;
const float Inv255 = 1. / 255.;
const vec4 PackFactors = vec4( 1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0 );
const vec2 UnpackFactors2 = vec2( UnpackDownscale, 1.0 / PackFactors.g );
const vec3 UnpackFactors3 = vec3( UnpackDownscale / PackFactors.rg, 1.0 / PackFactors.b );
const vec4 UnpackFactors4 = vec4( UnpackDownscale / PackFactors.rgb, 1.0 / PackFactors.a );
vec4 packDepthToRGBA( const in float v ) {
	if( v <= 0.0 )
		return vec4( 0., 0., 0., 0. );
	if( v >= 1.0 )
		return vec4( 1., 1., 1., 1. );
	float vuf;
	float af = modf( v * PackFactors.a, vuf );
	float bf = modf( vuf * ShiftRight8, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec4( vuf * Inv255, gf * PackUpscale, bf * PackUpscale, af );
}
vec3 packDepthToRGB( const in float v ) {
	if( v <= 0.0 )
		return vec3( 0., 0., 0. );
	if( v >= 1.0 )
		return vec3( 1., 1., 1. );
	float vuf;
	float bf = modf( v * PackFactors.b, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec3( vuf * Inv255, gf * PackUpscale, bf );
}
vec2 packDepthToRG( const in float v ) {
	if( v <= 0.0 )
		return vec2( 0., 0. );
	if( v >= 1.0 )
		return vec2( 1., 1. );
	float vuf;
	float gf = modf( v * 256., vuf );
	return vec2( vuf * Inv255, gf );
}
float unpackRGBAToDepth( const in vec4 v ) {
	return dot( v, UnpackFactors4 );
}
float unpackRGBToDepth( const in vec3 v ) {
	return dot( v, UnpackFactors3 );
}
float unpackRGToDepth( const in vec2 v ) {
	return v.r * UnpackFactors2.r + v.g * UnpackFactors2.g;
}
vec4 pack2HalfToRGBA( const in vec2 v ) {
	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );
	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );
}
vec2 unpackRGBATo2Half( const in vec4 v ) {
	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
}
float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
	return ( viewZ + near ) / ( near - far );
}
float orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {
	return depth * ( near - far ) - near;
}
float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {
	return ( near * far ) / ( ( far - near ) * depth - far );
}`,ul=`#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`,pl=`vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`,hl=`#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`,ml=`#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`,_l=`float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`,gl=`#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`,vl=`#if NUM_SPOT_LIGHT_COORDS > 0
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#if NUM_SPOT_LIGHT_MAPS > 0
	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform sampler2D pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
	float texture2DCompare( sampler2D depths, vec2 uv, float compare ) {
		float depth = unpackRGBAToDepth( texture2D( depths, uv ) );
		#ifdef USE_REVERSED_DEPTH_BUFFER
			return step( depth, compare );
		#else
			return step( compare, depth );
		#endif
	}
	vec2 texture2DDistribution( sampler2D shadow, vec2 uv ) {
		return unpackRGBATo2Half( texture2D( shadow, uv ) );
	}
	float VSMShadow( sampler2D shadow, vec2 uv, float compare ) {
		float occlusion = 1.0;
		vec2 distribution = texture2DDistribution( shadow, uv );
		#ifdef USE_REVERSED_DEPTH_BUFFER
			float hard_shadow = step( distribution.x, compare );
		#else
			float hard_shadow = step( compare, distribution.x );
		#endif
		if ( hard_shadow != 1.0 ) {
			float distance = compare - distribution.x;
			float variance = max( 0.00000, distribution.y * distribution.y );
			float softness_probability = variance / (variance + distance * distance );			softness_probability = clamp( ( softness_probability - 0.3 ) / ( 0.95 - 0.3 ), 0.0, 1.0 );			occlusion = clamp( max( hard_shadow, softness_probability ), 0.0, 1.0 );
		}
		return occlusion;
	}
	float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
		float shadow = 1.0;
		shadowCoord.xyz /= shadowCoord.w;
		shadowCoord.z += shadowBias;
		bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
		bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
		if ( frustumTest ) {
		#if defined( SHADOWMAP_TYPE_PCF )
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			float dx0 = - texelSize.x * shadowRadius;
			float dy0 = - texelSize.y * shadowRadius;
			float dx1 = + texelSize.x * shadowRadius;
			float dy1 = + texelSize.y * shadowRadius;
			float dx2 = dx0 / 2.0;
			float dy2 = dy0 / 2.0;
			float dx3 = dx1 / 2.0;
			float dy3 = dy1 / 2.0;
			shadow = (
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy1 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy1 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy1 ), shadowCoord.z )
			) * ( 1.0 / 17.0 );
		#elif defined( SHADOWMAP_TYPE_PCF_SOFT )
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			float dx = texelSize.x;
			float dy = texelSize.y;
			vec2 uv = shadowCoord.xy;
			vec2 f = fract( uv * shadowMapSize + 0.5 );
			uv -= f * texelSize;
			shadow = (
				texture2DCompare( shadowMap, uv, shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + vec2( dx, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + vec2( 0.0, dy ), shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + texelSize, shadowCoord.z ) +
				mix( texture2DCompare( shadowMap, uv + vec2( -dx, 0.0 ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 0.0 ), shadowCoord.z ),
					 f.x ) +
				mix( texture2DCompare( shadowMap, uv + vec2( -dx, dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, dy ), shadowCoord.z ),
					 f.x ) +
				mix( texture2DCompare( shadowMap, uv + vec2( 0.0, -dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 0.0, 2.0 * dy ), shadowCoord.z ),
					 f.y ) +
				mix( texture2DCompare( shadowMap, uv + vec2( dx, -dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( dx, 2.0 * dy ), shadowCoord.z ),
					 f.y ) +
				mix( mix( texture2DCompare( shadowMap, uv + vec2( -dx, -dy ), shadowCoord.z ),
						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, -dy ), shadowCoord.z ),
						  f.x ),
					 mix( texture2DCompare( shadowMap, uv + vec2( -dx, 2.0 * dy ), shadowCoord.z ),
						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 2.0 * dy ), shadowCoord.z ),
						  f.x ),
					 f.y )
			) * ( 1.0 / 9.0 );
		#elif defined( SHADOWMAP_TYPE_VSM )
			shadow = VSMShadow( shadowMap, shadowCoord.xy, shadowCoord.z );
		#else
			shadow = texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z );
		#endif
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	vec2 cubeToUV( vec3 v, float texelSizeY ) {
		vec3 absV = abs( v );
		float scaleToCube = 1.0 / max( absV.x, max( absV.y, absV.z ) );
		absV *= scaleToCube;
		v *= scaleToCube * ( 1.0 - 2.0 * texelSizeY );
		vec2 planar = v.xy;
		float almostATexel = 1.5 * texelSizeY;
		float almostOne = 1.0 - almostATexel;
		if ( absV.z >= almostOne ) {
			if ( v.z > 0.0 )
				planar.x = 4.0 - v.x;
		} else if ( absV.x >= almostOne ) {
			float signX = sign( v.x );
			planar.x = v.z * signX + 2.0 * signX;
		} else if ( absV.y >= almostOne ) {
			float signY = sign( v.y );
			planar.x = v.x + 2.0 * signY + 2.0;
			planar.y = v.z * signY - 2.0;
		}
		return vec2( 0.125, 0.25 ) * planar + vec2( 0.375, 0.75 );
	}
	float getPointShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		
		float lightToPositionLength = length( lightToPosition );
		if ( lightToPositionLength - shadowCameraFar <= 0.0 && lightToPositionLength - shadowCameraNear >= 0.0 ) {
			float dp = ( lightToPositionLength - shadowCameraNear ) / ( shadowCameraFar - shadowCameraNear );			dp += shadowBias;
			vec3 bd3D = normalize( lightToPosition );
			vec2 texelSize = vec2( 1.0 ) / ( shadowMapSize * vec2( 4.0, 2.0 ) );
			#if defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_PCF_SOFT ) || defined( SHADOWMAP_TYPE_VSM )
				vec2 offset = vec2( - 1, 1 ) * shadowRadius * texelSize.y;
				shadow = (
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxx, texelSize.y ), dp )
				) * ( 1.0 / 9.0 );
			#else
				shadow = texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp );
			#endif
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
#endif`,El=`#if NUM_SPOT_LIGHT_COORDS > 0
	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
#endif`,Sl=`#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
	vec3 shadowWorldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
	vec4 shadowWorldPosition;
#endif
#if defined( USE_SHADOWMAP )
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );
			vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );
			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
#endif
#if NUM_SPOT_LIGHT_COORDS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {
		shadowWorldPosition = worldPosition;
		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;
		#endif
		vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;
	}
	#pragma unroll_loop_end
#endif`,Ml=`float getShadowMask() {
	float shadow = 1.0;
	#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
		directionalLight = directionalLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowIntensity, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
		spotLight = spotLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowIntensity, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
		pointLight = pointLightShadows[ i ];
		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowIntensity, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#endif
	return shadow;
}`,Tl=`#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`,xl=`#ifdef USE_SKINNING
	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;
	uniform highp sampler2D boneTexture;
	mat4 getBoneMatrix( const in float i ) {
		int size = textureSize( boneTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif`,Al=`#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`,Rl=`#ifdef USE_SKINNING
	mat4 skinMatrix = mat4( 0.0 );
	skinMatrix += skinWeight.x * boneMatX;
	skinMatrix += skinWeight.y * boneMatY;
	skinMatrix += skinWeight.z * boneMatZ;
	skinMatrix += skinWeight.w * boneMatW;
	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
	#ifdef USE_TANGENT
		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#endif
#endif`,Cl=`float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`,bl=`#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`,wl=`#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`,Pl=`#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
uniform float toneMappingExposure;
vec3 LinearToneMapping( vec3 color ) {
	return saturate( toneMappingExposure * color );
}
vec3 ReinhardToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	return saturate( color / ( vec3( 1.0 ) + color ) );
}
vec3 CineonToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	color = max( vec3( 0.0 ), color - 0.004 );
	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );
}
vec3 RRTAndODTFit( vec3 v ) {
	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
	return a / b;
}
vec3 ACESFilmicToneMapping( vec3 color ) {
	const mat3 ACESInputMat = mat3(
		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
	);
	const mat3 ACESOutputMat = mat3(
		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605,  1.07602 )
	);
	color *= toneMappingExposure / 0.6;
	color = ACESInputMat * color;
	color = RRTAndODTFit( color );
	color = ACESOutputMat * color;
	return saturate( color );
}
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
	vec3( 1.6605, - 0.1246, - 0.0182 ),
	vec3( - 0.5876, 1.1329, - 0.1006 ),
	vec3( - 0.0728, - 0.0083, 1.1187 )
);
const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
	vec3( 0.6274, 0.0691, 0.0164 ),
	vec3( 0.3293, 0.9195, 0.0880 ),
	vec3( 0.0433, 0.0113, 0.8956 )
);
vec3 agxDefaultContrastApprox( vec3 x ) {
	vec3 x2 = x * x;
	vec3 x4 = x2 * x2;
	return + 15.5 * x4 * x2
		- 40.14 * x4 * x
		+ 31.96 * x4
		- 6.868 * x2 * x
		+ 0.4298 * x2
		+ 0.1191 * x
		- 0.00232;
}
vec3 AgXToneMapping( vec3 color ) {
	const mat3 AgXInsetMatrix = mat3(
		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),
		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )
	);
	const mat3 AgXOutsetMatrix = mat3(
		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),
		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),
		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )
	);
	const float AgxMinEv = - 12.47393;	const float AgxMaxEv = 4.026069;
	color *= toneMappingExposure;
	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
	color = AgXInsetMatrix * color;
	color = max( color, 1e-10 );	color = log2( color );
	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );
	color = clamp( color, 0.0, 1.0 );
	color = agxDefaultContrastApprox( color );
	color = AgXOutsetMatrix * color;
	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );
	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
	color = clamp( color, 0.0, 1.0 );
	return color;
}
vec3 NeutralToneMapping( vec3 color ) {
	const float StartCompression = 0.8 - 0.04;
	const float Desaturation = 0.15;
	color *= toneMappingExposure;
	float x = min( color.r, min( color.g, color.b ) );
	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
	color -= offset;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak < StartCompression ) return color;
	float d = 1. - StartCompression;
	float newPeak = 1. - d * d / ( peak + d - StartCompression );
	color *= newPeak / peak;
	float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );
	return mix( color, vec3( newPeak ), g );
}
vec3 CustomToneMapping( vec3 color ) { return color; }`,Ll=`#ifdef USE_TRANSMISSION
	material.transmission = transmission;
	material.transmissionAlpha = 1.0;
	material.thickness = thickness;
	material.attenuationDistance = attenuationDistance;
	material.attenuationColor = attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;
	#endif
	#ifdef USE_THICKNESSMAP
		material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;
	#endif
	vec3 pos = vWorldPosition;
	vec3 v = normalize( cameraPosition - pos );
	vec3 n = inverseTransformDirection( normal, viewMatrix );
	vec4 transmitted = getIBLVolumeRefraction(
		n, v, material.roughness, material.diffuseColor, material.specularColor, material.specularF90,
		pos, modelMatrix, viewMatrix, projectionMatrix, material.dispersion, material.ior, material.thickness,
		material.attenuationColor, material.attenuationDistance );
	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );
	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );
#endif`,Dl=`#ifdef USE_TRANSMISSION
	uniform float transmission;
	uniform float thickness;
	uniform float attenuationDistance;
	uniform vec3 attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		uniform sampler2D transmissionMap;
	#endif
	#ifdef USE_THICKNESSMAP
		uniform sampler2D thicknessMap;
	#endif
	uniform vec2 transmissionSamplerSize;
	uniform sampler2D transmissionSamplerMap;
	uniform mat4 modelMatrix;
	uniform mat4 projectionMatrix;
	varying vec3 vWorldPosition;
	float w0( float a ) {
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );
	}
	float w1( float a ) {
		return ( 1.0 / 6.0 ) * ( a *  a * ( 3.0 * a - 6.0 ) + 4.0 );
	}
	float w2( float a ){
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );
	}
	float w3( float a ) {
		return ( 1.0 / 6.0 ) * ( a * a * a );
	}
	float g0( float a ) {
		return w0( a ) + w1( a );
	}
	float g1( float a ) {
		return w2( a ) + w3( a );
	}
	float h0( float a ) {
		return - 1.0 + w1( a ) / ( w0( a ) + w1( a ) );
	}
	float h1( float a ) {
		return 1.0 + w3( a ) / ( w2( a ) + w3( a ) );
	}
	vec4 bicubic( sampler2D tex, vec2 uv, vec4 texelSize, float lod ) {
		uv = uv * texelSize.zw + 0.5;
		vec2 iuv = floor( uv );
		vec2 fuv = fract( uv );
		float g0x = g0( fuv.x );
		float g1x = g1( fuv.x );
		float h0x = h0( fuv.x );
		float h1x = h1( fuv.x );
		float h0y = h0( fuv.y );
		float h1y = h1( fuv.y );
		vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		return g0( fuv.y ) * ( g0x * textureLod( tex, p0, lod ) + g1x * textureLod( tex, p1, lod ) ) +
			g1( fuv.y ) * ( g0x * textureLod( tex, p2, lod ) + g1x * textureLod( tex, p3, lod ) );
	}
	vec4 textureBicubic( sampler2D sampler, vec2 uv, float lod ) {
		vec2 fLodSize = vec2( textureSize( sampler, int( lod ) ) );
		vec2 cLodSize = vec2( textureSize( sampler, int( lod + 1.0 ) ) );
		vec2 fLodSizeInv = 1.0 / fLodSize;
		vec2 cLodSizeInv = 1.0 / cLodSize;
		vec4 fSample = bicubic( sampler, uv, vec4( fLodSizeInv, fLodSize ), floor( lod ) );
		vec4 cSample = bicubic( sampler, uv, vec4( cLodSizeInv, cLodSize ), ceil( lod ) );
		return mix( fSample, cSample, fract( lod ) );
	}
	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {
		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );
		vec3 modelScale;
		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );
		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );
		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );
		return normalize( refractionVector ) * thickness * modelScale;
	}
	float applyIorToRoughness( const in float roughness, const in float ior ) {
		return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );
	}
	vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {
		float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );
		return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );
	}
	vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {
		if ( isinf( attenuationDistance ) ) {
			return vec3( 1.0 );
		} else {
			vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
			vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance );			return transmittance;
		}
	}
	vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,
		const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,
		const in mat4 viewMatrix, const in mat4 projMatrix, const in float dispersion, const in float ior, const in float thickness,
		const in vec3 attenuationColor, const in float attenuationDistance ) {
		vec4 transmittedLight;
		vec3 transmittance;
		#ifdef USE_DISPERSION
			float halfSpread = ( ior - 1.0 ) * 0.025 * dispersion;
			vec3 iors = vec3( ior - halfSpread, ior, ior + halfSpread );
			for ( int i = 0; i < 3; i ++ ) {
				vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, iors[ i ], modelMatrix );
				vec3 refractedRayExit = position + transmissionRay;
				vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
				vec2 refractionCoords = ndcPos.xy / ndcPos.w;
				refractionCoords += 1.0;
				refractionCoords /= 2.0;
				vec4 transmissionSample = getTransmissionSample( refractionCoords, roughness, iors[ i ] );
				transmittedLight[ i ] = transmissionSample[ i ];
				transmittedLight.a += transmissionSample.a;
				transmittance[ i ] = diffuseColor[ i ] * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance )[ i ];
			}
			transmittedLight.a /= 3.0;
		#else
			vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
			vec3 refractedRayExit = position + transmissionRay;
			vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
			vec2 refractionCoords = ndcPos.xy / ndcPos.w;
			refractionCoords += 1.0;
			refractionCoords /= 2.0;
			transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );
			transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );
		#endif
		vec3 attenuatedColor = transmittance * transmittedLight.rgb;
		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );
		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;
		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );
	}
#endif`,yl=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_SPECULARMAP
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,Ul=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	uniform mat3 mapTransform;
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	uniform mat3 alphaMapTransform;
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	uniform mat3 lightMapTransform;
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	uniform mat3 aoMapTransform;
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	uniform mat3 bumpMapTransform;
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	uniform mat3 normalMapTransform;
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_DISPLACEMENTMAP
	uniform mat3 displacementMapTransform;
	varying vec2 vDisplacementMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	uniform mat3 emissiveMapTransform;
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	uniform mat3 metalnessMapTransform;
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	uniform mat3 roughnessMapTransform;
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	uniform mat3 anisotropyMapTransform;
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	uniform mat3 clearcoatMapTransform;
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform mat3 clearcoatNormalMapTransform;
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform mat3 clearcoatRoughnessMapTransform;
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	uniform mat3 sheenColorMapTransform;
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	uniform mat3 sheenRoughnessMapTransform;
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	uniform mat3 iridescenceMapTransform;
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform mat3 iridescenceThicknessMapTransform;
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SPECULARMAP
	uniform mat3 specularMapTransform;
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	uniform mat3 specularColorMapTransform;
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	uniform mat3 specularIntensityMapTransform;
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`,Il=`#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	vUv = vec3( uv, 1 ).xy;
#endif
#ifdef USE_MAP
	vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ALPHAMAP
	vAlphaMapUv = ( alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_LIGHTMAP
	vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_AOMAP
	vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_BUMPMAP
	vBumpMapUv = ( bumpMapTransform * vec3( BUMPMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_NORMALMAP
	vNormalMapUv = ( normalMapTransform * vec3( NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_DISPLACEMENTMAP
	vDisplacementMapUv = ( displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_EMISSIVEMAP
	vEmissiveMapUv = ( emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_METALNESSMAP
	vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ROUGHNESSMAP
	vRoughnessMapUv = ( roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ANISOTROPYMAP
	vAnisotropyMapUv = ( anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOATMAP
	vClearcoatMapUv = ( clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	vClearcoatNormalMapUv = ( clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	vClearcoatRoughnessMapUv = ( clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCEMAP
	vIridescenceMapUv = ( iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	vIridescenceThicknessMapUv = ( iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_COLORMAP
	vSheenColorMapUv = ( sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	vSheenRoughnessMapUv = ( sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULARMAP
	vSpecularMapUv = ( specularMapTransform * vec3( SPECULARMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_COLORMAP
	vSpecularColorMapUv = ( specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	vSpecularIntensityMapUv = ( specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_TRANSMISSIONMAP
	vTransmissionMapUv = ( transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_THICKNESSMAP
	vThicknessMapUv = ( thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) ).xy;
#endif`,Nl=`#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`;const Ol=`varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`,Fl=`uniform sampler2D t2D;
uniform float backgroundIntensity;
varying vec2 vUv;
void main() {
	vec4 texColor = texture2D( t2D, vUv );
	#ifdef DECODE_VIDEO_TEXTURE
		texColor = vec4( mix( pow( texColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), texColor.rgb * 0.0773993808, vec3( lessThanEqual( texColor.rgb, vec3( 0.04045 ) ) ) ), texColor.w );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Bl=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,Gl=`#ifdef ENVMAP_TYPE_CUBE
	uniform samplerCube envMap;
#elif defined( ENVMAP_TYPE_CUBE_UV )
	uniform sampler2D envMap;
#endif
uniform float flipEnvMap;
uniform float backgroundBlurriness;
uniform float backgroundIntensity;
uniform mat3 backgroundRotation;
varying vec3 vWorldDirection;
#include <cube_uv_reflection_fragment>
void main() {
	#ifdef ENVMAP_TYPE_CUBE
		vec4 texColor = textureCube( envMap, backgroundRotation * vec3( flipEnvMap * vWorldDirection.x, vWorldDirection.yz ) );
	#elif defined( ENVMAP_TYPE_CUBE_UV )
		vec4 texColor = textureCubeUV( envMap, backgroundRotation * vWorldDirection, backgroundBlurriness );
	#else
		vec4 texColor = vec4( 0.0, 0.0, 0.0, 1.0 );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,Hl=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`,Vl=`uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,kl=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
varying vec2 vHighPrecisionZW;
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vHighPrecisionZW = gl_Position.zw;
}`,Wl=`#if DEPTH_PACKING == 3200
	uniform float opacity;
#endif
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
varying vec2 vHighPrecisionZW;
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#if DEPTH_PACKING == 3200
		diffuseColor.a = opacity;
	#endif
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <logdepthbuf_fragment>
	#ifdef USE_REVERSED_DEPTH_BUFFER
		float fragCoordZ = vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ];
	#else
		float fragCoordZ = 0.5 * vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ] + 0.5;
	#endif
	#if DEPTH_PACKING == 3200
		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );
	#elif DEPTH_PACKING == 3201
		gl_FragColor = packDepthToRGBA( fragCoordZ );
	#elif DEPTH_PACKING == 3202
		gl_FragColor = vec4( packDepthToRGB( fragCoordZ ), 1.0 );
	#elif DEPTH_PACKING == 3203
		gl_FragColor = vec4( packDepthToRG( fragCoordZ ), 0.0, 1.0 );
	#endif
}`,zl=`#define DISTANCE
varying vec3 vWorldPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <worldpos_vertex>
	#include <clipping_planes_vertex>
	vWorldPosition = worldPosition.xyz;
}`,Xl=`#define DISTANCE
uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <clipping_planes_pars_fragment>
void main () {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist );
	gl_FragColor = packDepthToRGBA( dist );
}`,Kl=`varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`,Yl=`uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`,ql=`uniform float scale;
attribute float lineDistance;
varying float vLineDistance;
#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	vLineDistance = scale * lineDistance;
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,$l=`uniform vec3 diffuse;
uniform float opacity;
uniform float dashSize;
uniform float totalSize;
varying float vLineDistance;
#include <common>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	if ( mod( vLineDistance, totalSize ) > dashSize ) {
		discard;
	}
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,Zl=`#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinbase_vertex>
		#include <skinnormal_vertex>
		#include <defaultnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <fog_vertex>
}`,jl=`uniform vec3 diffuse;
uniform float opacity;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;
	#else
		reflectedLight.indirectDiffuse += vec3( 1.0 );
	#endif
	#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= diffuseColor.rgb;
	vec3 outgoingLight = reflectedLight.indirectDiffuse;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,Ql=`#define LAMBERT
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,Jl=`#define LAMBERT
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_lambert_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_lambert_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,ef=`#define MATCAP
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
	vViewPosition = - mvPosition.xyz;
}`,tf=`#define MATCAP
uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D matcap;
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	vec3 viewDir = normalize( vViewPosition );
	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
	vec3 y = cross( viewDir, x );
	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;
	#ifdef USE_MATCAP
		vec4 matcapColor = texture2D( matcap, uv );
	#else
		vec4 matcapColor = vec4( vec3( mix( 0.2, 0.8, uv.y ) ), 1.0 );
	#endif
	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,nf=`#define NORMAL
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	vViewPosition = - mvPosition.xyz;
#endif
}`,rf=`#define NORMAL
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <packing>
#include <uv_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 0.0, 0.0, 0.0, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	gl_FragColor = vec4( packNormalToRGB( normal ), diffuseColor.a );
	#ifdef OPAQUE
		gl_FragColor.a = 1.0;
	#endif
}`,af=`#define PHONG
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,of=`#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,sf=`#define STANDARD
varying vec3 vViewPosition;
#ifdef USE_TRANSMISSION
	varying vec3 vWorldPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
#ifdef USE_TRANSMISSION
	vWorldPosition = worldPosition.xyz;
#endif
}`,cf=`#define STANDARD
#ifdef PHYSICAL
	#define IOR
	#define USE_SPECULAR
#endif
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
#ifdef IOR
	uniform float ior;
#endif
#ifdef USE_SPECULAR
	uniform float specularIntensity;
	uniform vec3 specularColor;
	#ifdef USE_SPECULAR_COLORMAP
		uniform sampler2D specularColorMap;
	#endif
	#ifdef USE_SPECULAR_INTENSITYMAP
		uniform sampler2D specularIntensityMap;
	#endif
#endif
#ifdef USE_CLEARCOAT
	uniform float clearcoat;
	uniform float clearcoatRoughness;
#endif
#ifdef USE_DISPERSION
	uniform float dispersion;
#endif
#ifdef USE_IRIDESCENCE
	uniform float iridescence;
	uniform float iridescenceIOR;
	uniform float iridescenceThicknessMinimum;
	uniform float iridescenceThicknessMaximum;
#endif
#ifdef USE_SHEEN
	uniform vec3 sheenColor;
	uniform float sheenRoughness;
	#ifdef USE_SHEEN_COLORMAP
		uniform sampler2D sheenColorMap;
	#endif
	#ifdef USE_SHEEN_ROUGHNESSMAP
		uniform sampler2D sheenRoughnessMap;
	#endif
#endif
#ifdef USE_ANISOTROPY
	uniform vec2 anisotropyVector;
	#ifdef USE_ANISOTROPYMAP
		uniform sampler2D anisotropyMap;
	#endif
#endif
varying vec3 vViewPosition;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <iridescence_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>
#include <transmission_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <iridescence_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <roughnessmap_fragment>
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_physical_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
	#include <transmission_fragment>
	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
	#ifdef USE_SHEEN
		float sheenEnergyComp = 1.0 - 0.157 * max3( material.sheenColor );
		outgoingLight = outgoingLight * sheenEnergyComp + sheenSpecularDirect + sheenSpecularIndirect;
	#endif
	#ifdef USE_CLEARCOAT
		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );
		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );
		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;
	#endif
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,lf=`#define TOON
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,ff=`#define TOON
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <gradientmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_toon_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_toon_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`,df=`uniform float size;
uniform float scale;
#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
#ifdef USE_POINTS_UV
	varying vec2 vUv;
	uniform mat3 uvTransform;
#endif
void main() {
	#ifdef USE_POINTS_UV
		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	#endif
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	gl_PointSize = size;
	#ifdef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );
	#endif
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <fog_vertex>
}`,uf=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <color_pars_fragment>
#include <map_particle_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_particle_fragment>
	#include <color_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`,pf=`#include <common>
#include <batching_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>
void main() {
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`,hf=`uniform vec3 color;
uniform float opacity;
#include <common>
#include <packing>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <logdepthbuf_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
void main() {
	#include <logdepthbuf_fragment>
	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,mf=`uniform float rotation;
uniform vec2 center;
#include <common>
#include <uv_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	vec4 mvPosition = modelViewMatrix[ 3 ];
	vec2 scale = vec2( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ) );
	#ifndef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) scale *= - mvPosition.z;
	#endif
	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;
	vec2 rotatedPosition;
	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
	mvPosition.xy += rotatedPosition;
	gl_Position = projectionMatrix * mvPosition;
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`,_f=`uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`,Be={alphahash_fragment:Fs,alphahash_pars_fragment:Bs,alphamap_fragment:Gs,alphamap_pars_fragment:Hs,alphatest_fragment:Vs,alphatest_pars_fragment:ks,aomap_fragment:Ws,aomap_pars_fragment:zs,batching_pars_vertex:Xs,batching_vertex:Ks,begin_vertex:Ys,beginnormal_vertex:qs,bsdfs:$s,iridescence_fragment:Zs,bumpmap_pars_fragment:js,clipping_planes_fragment:Qs,clipping_planes_pars_fragment:Js,clipping_planes_pars_vertex:ec,clipping_planes_vertex:tc,color_fragment:nc,color_pars_fragment:ic,color_pars_vertex:rc,color_vertex:ac,common:oc,cube_uv_reflection_fragment:sc,defaultnormal_vertex:cc,displacementmap_pars_vertex:lc,displacementmap_vertex:fc,emissivemap_fragment:dc,emissivemap_pars_fragment:uc,colorspace_fragment:pc,colorspace_pars_fragment:hc,envmap_fragment:mc,envmap_common_pars_fragment:_c,envmap_pars_fragment:gc,envmap_pars_vertex:vc,envmap_physical_pars_fragment:Pc,envmap_vertex:Ec,fog_vertex:Sc,fog_pars_vertex:Mc,fog_fragment:Tc,fog_pars_fragment:xc,gradientmap_pars_fragment:Ac,lightmap_pars_fragment:Rc,lights_lambert_fragment:Cc,lights_lambert_pars_fragment:bc,lights_pars_begin:wc,lights_toon_fragment:Lc,lights_toon_pars_fragment:Dc,lights_phong_fragment:yc,lights_phong_pars_fragment:Uc,lights_physical_fragment:Ic,lights_physical_pars_fragment:Nc,lights_fragment_begin:Oc,lights_fragment_maps:Fc,lights_fragment_end:Bc,logdepthbuf_fragment:Gc,logdepthbuf_pars_fragment:Hc,logdepthbuf_pars_vertex:Vc,logdepthbuf_vertex:kc,map_fragment:Wc,map_pars_fragment:zc,map_particle_fragment:Xc,map_particle_pars_fragment:Kc,metalnessmap_fragment:Yc,metalnessmap_pars_fragment:qc,morphinstance_vertex:$c,morphcolor_vertex:Zc,morphnormal_vertex:jc,morphtarget_pars_vertex:Qc,morphtarget_vertex:Jc,normal_fragment_begin:el,normal_fragment_maps:tl,normal_pars_fragment:nl,normal_pars_vertex:il,normal_vertex:rl,normalmap_pars_fragment:al,clearcoat_normal_fragment_begin:ol,clearcoat_normal_fragment_maps:sl,clearcoat_pars_fragment:cl,iridescence_pars_fragment:ll,opaque_fragment:fl,packing:dl,premultiplied_alpha_fragment:ul,project_vertex:pl,dithering_fragment:hl,dithering_pars_fragment:ml,roughnessmap_fragment:_l,roughnessmap_pars_fragment:gl,shadowmap_pars_fragment:vl,shadowmap_pars_vertex:El,shadowmap_vertex:Sl,shadowmask_pars_fragment:Ml,skinbase_vertex:Tl,skinning_pars_vertex:xl,skinning_vertex:Al,skinnormal_vertex:Rl,specularmap_fragment:Cl,specularmap_pars_fragment:bl,tonemapping_fragment:wl,tonemapping_pars_fragment:Pl,transmission_fragment:Ll,transmission_pars_fragment:Dl,uv_pars_fragment:yl,uv_pars_vertex:Ul,uv_vertex:Il,worldpos_vertex:Nl,background_vert:Ol,background_frag:Fl,backgroundCube_vert:Bl,backgroundCube_frag:Gl,cube_vert:Hl,cube_frag:Vl,depth_vert:kl,depth_frag:Wl,distanceRGBA_vert:zl,distanceRGBA_frag:Xl,equirect_vert:Kl,equirect_frag:Yl,linedashed_vert:ql,linedashed_frag:$l,meshbasic_vert:Zl,meshbasic_frag:jl,meshlambert_vert:Ql,meshlambert_frag:Jl,meshmatcap_vert:ef,meshmatcap_frag:tf,meshnormal_vert:nf,meshnormal_frag:rf,meshphong_vert:af,meshphong_frag:of,meshphysical_vert:sf,meshphysical_frag:cf,meshtoon_vert:lf,meshtoon_frag:ff,points_vert:df,points_frag:uf,shadow_vert:pf,shadow_frag:hf,sprite_vert:mf,sprite_frag:_f},ae={common:{diffuse:{value:new Ye(16777215)},opacity:{value:1},map:{value:null},mapTransform:{value:new ke},alphaMap:{value:null},alphaMapTransform:{value:new ke},alphaTest:{value:0}},specularmap:{specularMap:{value:null},specularMapTransform:{value:new ke}},envmap:{envMap:{value:null},envMapRotation:{value:new ke},flipEnvMap:{value:-1},reflectivity:{value:1},ior:{value:1.5},refractionRatio:{value:.98}},aomap:{aoMap:{value:null},aoMapIntensity:{value:1},aoMapTransform:{value:new ke}},lightmap:{lightMap:{value:null},lightMapIntensity:{value:1},lightMapTransform:{value:new ke}},bumpmap:{bumpMap:{value:null},bumpMapTransform:{value:new ke},bumpScale:{value:1}},normalmap:{normalMap:{value:null},normalMapTransform:{value:new ke},normalScale:{value:new gt(1,1)}},displacementmap:{displacementMap:{value:null},displacementMapTransform:{value:new ke},displacementScale:{value:1},displacementBias:{value:0}},emissivemap:{emissiveMap:{value:null},emissiveMapTransform:{value:new ke}},metalnessmap:{metalnessMap:{value:null},metalnessMapTransform:{value:new ke}},roughnessmap:{roughnessMap:{value:null},roughnessMapTransform:{value:new ke}},gradientmap:{gradientMap:{value:null}},fog:{fogDensity:{value:25e-5},fogNear:{value:1},fogFar:{value:2e3},fogColor:{value:new Ye(16777215)}},lights:{ambientLightColor:{value:[]},lightProbe:{value:[]},directionalLights:{value:[],properties:{direction:{},color:{}}},directionalLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},directionalShadowMap:{value:[]},directionalShadowMatrix:{value:[]},spotLights:{value:[],properties:{color:{},position:{},direction:{},distance:{},coneCos:{},penumbraCos:{},decay:{}}},spotLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{}}},spotLightMap:{value:[]},spotShadowMap:{value:[]},spotLightMatrix:{value:[]},pointLights:{value:[],properties:{color:{},position:{},decay:{},distance:{}}},pointLightShadows:{value:[],properties:{shadowIntensity:1,shadowBias:{},shadowNormalBias:{},shadowRadius:{},shadowMapSize:{},shadowCameraNear:{},shadowCameraFar:{}}},pointShadowMap:{value:[]},pointShadowMatrix:{value:[]},hemisphereLights:{value:[],properties:{direction:{},skyColor:{},groundColor:{}}},rectAreaLights:{value:[],properties:{color:{},position:{},width:{},height:{}}},ltc_1:{value:null},ltc_2:{value:null}},points:{diffuse:{value:new Ye(16777215)},opacity:{value:1},size:{value:1},scale:{value:1},map:{value:null},alphaMap:{value:null},alphaMapTransform:{value:new ke},alphaTest:{value:0},uvTransform:{value:new ke}},sprite:{diffuse:{value:new Ye(16777215)},opacity:{value:1},center:{value:new gt(.5,.5)},rotation:{value:0},map:{value:null},mapTransform:{value:new ke},alphaMap:{value:null},alphaMapTransform:{value:new ke},alphaTest:{value:0}}},It={basic:{uniforms:Mt([ae.common,ae.specularmap,ae.envmap,ae.aomap,ae.lightmap,ae.fog]),vertexShader:Be.meshbasic_vert,fragmentShader:Be.meshbasic_frag},lambert:{uniforms:Mt([ae.common,ae.specularmap,ae.envmap,ae.aomap,ae.lightmap,ae.emissivemap,ae.bumpmap,ae.normalmap,ae.displacementmap,ae.fog,ae.lights,{emissive:{value:new Ye(0)}}]),vertexShader:Be.meshlambert_vert,fragmentShader:Be.meshlambert_frag},phong:{uniforms:Mt([ae.common,ae.specularmap,ae.envmap,ae.aomap,ae.lightmap,ae.emissivemap,ae.bumpmap,ae.normalmap,ae.displacementmap,ae.fog,ae.lights,{emissive:{value:new Ye(0)},specular:{value:new Ye(1118481)},shininess:{value:30}}]),vertexShader:Be.meshphong_vert,fragmentShader:Be.meshphong_frag},standard:{uniforms:Mt([ae.common,ae.envmap,ae.aomap,ae.lightmap,ae.emissivemap,ae.bumpmap,ae.normalmap,ae.displacementmap,ae.roughnessmap,ae.metalnessmap,ae.fog,ae.lights,{emissive:{value:new Ye(0)},roughness:{value:1},metalness:{value:0},envMapIntensity:{value:1}}]),vertexShader:Be.meshphysical_vert,fragmentShader:Be.meshphysical_frag},toon:{uniforms:Mt([ae.common,ae.aomap,ae.lightmap,ae.emissivemap,ae.bumpmap,ae.normalmap,ae.displacementmap,ae.gradientmap,ae.fog,ae.lights,{emissive:{value:new Ye(0)}}]),vertexShader:Be.meshtoon_vert,fragmentShader:Be.meshtoon_frag},matcap:{uniforms:Mt([ae.common,ae.bumpmap,ae.normalmap,ae.displacementmap,ae.fog,{matcap:{value:null}}]),vertexShader:Be.meshmatcap_vert,fragmentShader:Be.meshmatcap_frag},points:{uniforms:Mt([ae.points,ae.fog]),vertexShader:Be.points_vert,fragmentShader:Be.points_frag},dashed:{uniforms:Mt([ae.common,ae.fog,{scale:{value:1},dashSize:{value:1},totalSize:{value:2}}]),vertexShader:Be.linedashed_vert,fragmentShader:Be.linedashed_frag},depth:{uniforms:Mt([ae.common,ae.displacementmap]),vertexShader:Be.depth_vert,fragmentShader:Be.depth_frag},normal:{uniforms:Mt([ae.common,ae.bumpmap,ae.normalmap,ae.displacementmap,{opacity:{value:1}}]),vertexShader:Be.meshnormal_vert,fragmentShader:Be.meshnormal_frag},sprite:{uniforms:Mt([ae.sprite,ae.fog]),vertexShader:Be.sprite_vert,fragmentShader:Be.sprite_frag},background:{uniforms:{uvTransform:{value:new ke},t2D:{value:null},backgroundIntensity:{value:1}},vertexShader:Be.background_vert,fragmentShader:Be.background_frag},backgroundCube:{uniforms:{envMap:{value:null},flipEnvMap:{value:-1},backgroundBlurriness:{value:0},backgroundIntensity:{value:1},backgroundRotation:{value:new ke}},vertexShader:Be.backgroundCube_vert,fragmentShader:Be.backgroundCube_frag},cube:{uniforms:{tCube:{value:null},tFlip:{value:-1},opacity:{value:1}},vertexShader:Be.cube_vert,fragmentShader:Be.cube_frag},equirect:{uniforms:{tEquirect:{value:null}},vertexShader:Be.equirect_vert,fragmentShader:Be.equirect_frag},distanceRGBA:{uniforms:Mt([ae.common,ae.displacementmap,{referencePosition:{value:new Le},nearDistance:{value:1},farDistance:{value:1e3}}]),vertexShader:Be.distanceRGBA_vert,fragmentShader:Be.distanceRGBA_frag},shadow:{uniforms:Mt([ae.lights,ae.fog,{color:{value:new Ye(0)},opacity:{value:1}}]),vertexShader:Be.shadow_vert,fragmentShader:Be.shadow_frag}};It.physical={uniforms:Mt([It.standard.uniforms,{clearcoat:{value:0},clearcoatMap:{value:null},clearcoatMapTransform:{value:new ke},clearcoatNormalMap:{value:null},clearcoatNormalMapTransform:{value:new ke},clearcoatNormalScale:{value:new gt(1,1)},clearcoatRoughness:{value:0},clearcoatRoughnessMap:{value:null},clearcoatRoughnessMapTransform:{value:new ke},dispersion:{value:0},iridescence:{value:0},iridescenceMap:{value:null},iridescenceMapTransform:{value:new ke},iridescenceIOR:{value:1.3},iridescenceThicknessMinimum:{value:100},iridescenceThicknessMaximum:{value:400},iridescenceThicknessMap:{value:null},iridescenceThicknessMapTransform:{value:new ke},sheen:{value:0},sheenColor:{value:new Ye(0)},sheenColorMap:{value:null},sheenColorMapTransform:{value:new ke},sheenRoughness:{value:1},sheenRoughnessMap:{value:null},sheenRoughnessMapTransform:{value:new ke},transmission:{value:0},transmissionMap:{value:null},transmissionMapTransform:{value:new ke},transmissionSamplerSize:{value:new gt},transmissionSamplerMap:{value:null},thickness:{value:0},thicknessMap:{value:null},thicknessMapTransform:{value:new ke},attenuationDistance:{value:0},attenuationColor:{value:new Ye(0)},specularColor:{value:new Ye(1,1,1)},specularColorMap:{value:null},specularColorMapTransform:{value:new ke},specularIntensity:{value:1},specularIntensityMap:{value:null},specularIntensityMapTransform:{value:new ke},anisotropyVector:{value:new gt},anisotropyMap:{value:null},anisotropyMapTransform:{value:new ke}}]),vertexShader:Be.meshphysical_vert,fragmentShader:Be.meshphysical_frag};const zn={r:0,b:0,g:0},Jt=new Gi,gf=new vn;function vf(e,n,t,i,o,r,p){const f=new Ye(0);let x=r===!0?0:1,M,b,v=null,S=0,T=null;function B(R){let g=R.isScene===!0?R.background:null;return g&&g.isTexture&&(g=(R.backgroundBlurriness>0?t:n).get(g)),g}function y(R){let g=!1;const O=B(R);O===null?a(f,x):O&&O.isColor&&(a(O,1),g=!0);const P=e.xr.getEnvironmentBlendMode();P==="additive"?i.buffers.color.setClear(0,0,0,1,p):P==="alpha-blend"&&i.buffers.color.setClear(0,0,0,0,p),(e.autoClear||g)&&(i.buffers.depth.setTest(!0),i.buffers.depth.setMask(!0),i.buffers.color.setMask(!0),e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil))}function d(R,g){const O=B(g);O&&(O.isCubeTexture||O.mapping===ri)?(b===void 0&&(b=new We(new $t(1,1,1),new cn({name:"BackgroundCubeMaterial",uniforms:Dr(It.backgroundCube.uniforms),vertexShader:It.backgroundCube.vertexShader,fragmentShader:It.backgroundCube.fragmentShader,side:Rt,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),b.geometry.deleteAttribute("normal"),b.geometry.deleteAttribute("uv"),b.onBeforeRender=function(P,D,G){this.matrixWorld.copyPosition(G.matrixWorld)},Object.defineProperty(b.material,"envMap",{get:function(){return this.uniforms.envMap.value}}),o.update(b)),Jt.copy(g.backgroundRotation),Jt.x*=-1,Jt.y*=-1,Jt.z*=-1,O.isCubeTexture&&O.isRenderTargetTexture===!1&&(Jt.y*=-1,Jt.z*=-1),b.material.uniforms.envMap.value=O,b.material.uniforms.flipEnvMap.value=O.isCubeTexture&&O.isRenderTargetTexture===!1?-1:1,b.material.uniforms.backgroundBlurriness.value=g.backgroundBlurriness,b.material.uniforms.backgroundIntensity.value=g.backgroundIntensity,b.material.uniforms.backgroundRotation.value.setFromMatrix4(gf.makeRotationFromEuler(Jt)),b.material.toneMapped=ft.getTransfer(O.colorSpace)!==Qe,(v!==O||S!==O.version||T!==e.toneMapping)&&(b.material.needsUpdate=!0,v=O,S=O.version,T=e.toneMapping),b.layers.enableAll(),R.unshift(b,b.geometry,b.material,0,0,null)):O&&O.isTexture&&(M===void 0&&(M=new We(new ti(2,2),new cn({name:"BackgroundMaterial",uniforms:Dr(It.background.uniforms),vertexShader:It.background.vertexShader,fragmentShader:It.background.fragmentShader,side:Un,depthTest:!1,depthWrite:!1,fog:!1,allowOverride:!1})),M.geometry.deleteAttribute("normal"),Object.defineProperty(M.material,"map",{get:function(){return this.uniforms.t2D.value}}),o.update(M)),M.material.uniforms.t2D.value=O,M.material.uniforms.backgroundIntensity.value=g.backgroundIntensity,M.material.toneMapped=ft.getTransfer(O.colorSpace)!==Qe,O.matrixAutoUpdate===!0&&O.updateMatrix(),M.material.uniforms.uvTransform.value.copy(O.matrix),(v!==O||S!==O.version||T!==e.toneMapping)&&(M.material.needsUpdate=!0,v=O,S=O.version,T=e.toneMapping),M.layers.enableAll(),R.unshift(M,M.geometry,M.material,0,0,null))}function a(R,g){R.getRGB(zn,Sa(e)),i.buffers.color.setClear(zn.r,zn.g,zn.b,g,p)}function U(){b!==void 0&&(b.geometry.dispose(),b.material.dispose(),b=void 0),M!==void 0&&(M.geometry.dispose(),M.material.dispose(),M=void 0)}return{getClearColor:function(){return f},setClearColor:function(R,g=1){f.set(R),x=g,a(f,x)},getClearAlpha:function(){return x},setClearAlpha:function(R){x=R,a(f,x)},render:y,addToRenderList:d,dispose:U}}function Ef(e,n){const t=e.getParameter(e.MAX_VERTEX_ATTRIBS),i={},o=S(null);let r=o,p=!1;function f(u,A,F,W,K){let q=!1;const Y=v(W,F,A);r!==Y&&(r=Y,M(r.object)),q=T(u,W,F,K),q&&B(u,W,F,K),K!==null&&n.update(K,e.ELEMENT_ARRAY_BUFFER),(q||p)&&(p=!1,g(u,A,F,W),K!==null&&e.bindBuffer(e.ELEMENT_ARRAY_BUFFER,n.get(K).buffer))}function x(){return e.createVertexArray()}function M(u){return e.bindVertexArray(u)}function b(u){return e.deleteVertexArray(u)}function v(u,A,F){const W=F.wireframe===!0;let K=i[u.id];K===void 0&&(K={},i[u.id]=K);let q=K[A.id];q===void 0&&(q={},K[A.id]=q);let Y=q[W];return Y===void 0&&(Y=S(x()),q[W]=Y),Y}function S(u){const A=[],F=[],W=[];for(let K=0;K<t;K++)A[K]=0,F[K]=0,W[K]=0;return{geometry:null,program:null,wireframe:!1,newAttributes:A,enabledAttributes:F,attributeDivisors:W,object:u,attributes:{},index:null}}function T(u,A,F,W){const K=r.attributes,q=A.attributes;let Y=0;const re=F.getAttributes();for(const k in re)if(re[k].location>=0){const Ae=K[k];let Oe=q[k];if(Oe===void 0&&(k==="instanceMatrix"&&u.instanceMatrix&&(Oe=u.instanceMatrix),k==="instanceColor"&&u.instanceColor&&(Oe=u.instanceColor)),Ae===void 0||Ae.attribute!==Oe||Oe&&Ae.data!==Oe.data)return!0;Y++}return r.attributesNum!==Y||r.index!==W}function B(u,A,F,W){const K={},q=A.attributes;let Y=0;const re=F.getAttributes();for(const k in re)if(re[k].location>=0){let Ae=q[k];Ae===void 0&&(k==="instanceMatrix"&&u.instanceMatrix&&(Ae=u.instanceMatrix),k==="instanceColor"&&u.instanceColor&&(Ae=u.instanceColor));const Oe={};Oe.attribute=Ae,Ae&&Ae.data&&(Oe.data=Ae.data),K[k]=Oe,Y++}r.attributes=K,r.attributesNum=Y,r.index=W}function y(){const u=r.newAttributes;for(let A=0,F=u.length;A<F;A++)u[A]=0}function d(u){a(u,0)}function a(u,A){const F=r.newAttributes,W=r.enabledAttributes,K=r.attributeDivisors;F[u]=1,W[u]===0&&(e.enableVertexAttribArray(u),W[u]=1),K[u]!==A&&(e.vertexAttribDivisor(u,A),K[u]=A)}function U(){const u=r.newAttributes,A=r.enabledAttributes;for(let F=0,W=A.length;F<W;F++)A[F]!==u[F]&&(e.disableVertexAttribArray(F),A[F]=0)}function R(u,A,F,W,K,q,Y){Y===!0?e.vertexAttribIPointer(u,A,F,K,q):e.vertexAttribPointer(u,A,F,W,K,q)}function g(u,A,F,W){y();const K=W.attributes,q=F.getAttributes(),Y=A.defaultAttributeValues;for(const re in q){const k=q[re];if(k.location>=0){let Ee=K[re];if(Ee===void 0&&(re==="instanceMatrix"&&u.instanceMatrix&&(Ee=u.instanceMatrix),re==="instanceColor"&&u.instanceColor&&(Ee=u.instanceColor)),Ee!==void 0){const Ae=Ee.normalized,Oe=Ee.itemSize,ze=n.get(Ee);if(ze===void 0)continue;const st=ze.buffer,rt=ze.type,qe=ze.bytesPerElement,z=rt===e.INT||rt===e.UNSIGNED_INT||Ee.gpuType===ma;if(Ee.isInterleavedBufferAttribute){const Z=Ee.data,de=Z.stride,De=Ee.offset;if(Z.isInstancedInterleavedBuffer){for(let Me=0;Me<k.locationSize;Me++)a(k.location+Me,Z.meshPerAttribute);u.isInstancedMesh!==!0&&W._maxInstanceCount===void 0&&(W._maxInstanceCount=Z.meshPerAttribute*Z.count)}else for(let Me=0;Me<k.locationSize;Me++)d(k.location+Me);e.bindBuffer(e.ARRAY_BUFFER,st);for(let Me=0;Me<k.locationSize;Me++)R(k.location+Me,Oe/k.locationSize,rt,Ae,de*qe,(De+Oe/k.locationSize*Me)*qe,z)}else{if(Ee.isInstancedBufferAttribute){for(let Z=0;Z<k.locationSize;Z++)a(k.location+Z,Ee.meshPerAttribute);u.isInstancedMesh!==!0&&W._maxInstanceCount===void 0&&(W._maxInstanceCount=Ee.meshPerAttribute*Ee.count)}else for(let Z=0;Z<k.locationSize;Z++)d(k.location+Z);e.bindBuffer(e.ARRAY_BUFFER,st);for(let Z=0;Z<k.locationSize;Z++)R(k.location+Z,Oe/k.locationSize,rt,Ae,Oe*qe,Oe/k.locationSize*Z*qe,z)}}else if(Y!==void 0){const Ae=Y[re];if(Ae!==void 0)switch(Ae.length){case 2:e.vertexAttrib2fv(k.location,Ae);break;case 3:e.vertexAttrib3fv(k.location,Ae);break;case 4:e.vertexAttrib4fv(k.location,Ae);break;default:e.vertexAttrib1fv(k.location,Ae)}}}}U()}function O(){G();for(const u in i){const A=i[u];for(const F in A){const W=A[F];for(const K in W)b(W[K].object),delete W[K];delete A[F]}delete i[u]}}function P(u){if(i[u.id]===void 0)return;const A=i[u.id];for(const F in A){const W=A[F];for(const K in W)b(W[K].object),delete W[K];delete A[F]}delete i[u.id]}function D(u){for(const A in i){const F=i[A];if(F[u.id]===void 0)continue;const W=F[u.id];for(const K in W)b(W[K].object),delete W[K];delete F[u.id]}}function G(){h(),p=!0,r!==o&&(r=o,M(r.object))}function h(){o.geometry=null,o.program=null,o.wireframe=!1}return{setup:f,reset:G,resetDefaultState:h,dispose:O,releaseStatesOfGeometry:P,releaseStatesOfProgram:D,initAttributes:y,enableAttribute:d,disableUnusedAttributes:U}}function Sf(e,n,t){let i;function o(M){i=M}function r(M,b){e.drawArrays(i,M,b),t.update(b,i,1)}function p(M,b,v){v!==0&&(e.drawArraysInstanced(i,M,b,v),t.update(b,i,v))}function f(M,b,v){if(v===0)return;n.get("WEBGL_multi_draw").multiDrawArraysWEBGL(i,M,0,b,0,v);let T=0;for(let B=0;B<v;B++)T+=b[B];t.update(T,i,1)}function x(M,b,v,S){if(v===0)return;const T=n.get("WEBGL_multi_draw");if(T===null)for(let B=0;B<M.length;B++)p(M[B],b[B],S[B]);else{T.multiDrawArraysInstancedWEBGL(i,M,0,b,0,S,0,v);let B=0;for(let y=0;y<v;y++)B+=b[y]*S[y];t.update(B,i,1)}}this.setMode=o,this.render=r,this.renderInstances=p,this.renderMultiDraw=f,this.renderMultiDrawInstances=x}function Mf(e,n,t,i){let o;function r(){if(o!==void 0)return o;if(n.has("EXT_texture_filter_anisotropic")===!0){const D=n.get("EXT_texture_filter_anisotropic");o=e.getParameter(D.MAX_TEXTURE_MAX_ANISOTROPY_EXT)}else o=0;return o}function p(D){return!(D!==Gt&&i.convert(D)!==e.getParameter(e.IMPLEMENTATION_COLOR_READ_FORMAT))}function f(D){const G=D===ni&&(n.has("EXT_color_buffer_half_float")||n.has("EXT_color_buffer_float"));return!(D!==sn&&i.convert(D)!==e.getParameter(e.IMPLEMENTATION_COLOR_READ_TYPE)&&D!==an&&!G)}function x(D){if(D==="highp"){if(e.getShaderPrecisionFormat(e.VERTEX_SHADER,e.HIGH_FLOAT).precision>0&&e.getShaderPrecisionFormat(e.FRAGMENT_SHADER,e.HIGH_FLOAT).precision>0)return"highp";D="mediump"}return D==="mediump"&&e.getShaderPrecisionFormat(e.VERTEX_SHADER,e.MEDIUM_FLOAT).precision>0&&e.getShaderPrecisionFormat(e.FRAGMENT_SHADER,e.MEDIUM_FLOAT).precision>0?"mediump":"lowp"}let M=t.precision!==void 0?t.precision:"highp";const b=x(M);b!==M&&(console.warn("THREE.WebGLRenderer:",M,"not supported, using",b,"instead."),M=b);const v=t.logarithmicDepthBuffer===!0,S=t.reversedDepthBuffer===!0&&n.has("EXT_clip_control"),T=e.getParameter(e.MAX_TEXTURE_IMAGE_UNITS),B=e.getParameter(e.MAX_VERTEX_TEXTURE_IMAGE_UNITS),y=e.getParameter(e.MAX_TEXTURE_SIZE),d=e.getParameter(e.MAX_CUBE_MAP_TEXTURE_SIZE),a=e.getParameter(e.MAX_VERTEX_ATTRIBS),U=e.getParameter(e.MAX_VERTEX_UNIFORM_VECTORS),R=e.getParameter(e.MAX_VARYING_VECTORS),g=e.getParameter(e.MAX_FRAGMENT_UNIFORM_VECTORS),O=B>0,P=e.getParameter(e.MAX_SAMPLES);return{isWebGL2:!0,getMaxAnisotropy:r,getMaxPrecision:x,textureFormatReadable:p,textureTypeReadable:f,precision:M,logarithmicDepthBuffer:v,reversedDepthBuffer:S,maxTextures:T,maxVertexTextures:B,maxTextureSize:y,maxCubemapSize:d,maxAttributes:a,maxVertexUniforms:U,maxVaryings:R,maxFragmentUniforms:g,vertexTextures:O,maxSamples:P}}function Tf(e){const n=this;let t=null,i=0,o=!1,r=!1;const p=new Io,f=new ke,x={value:null,needsUpdate:!1};this.uniform=x,this.numPlanes=0,this.numIntersection=0,this.init=function(v,S){const T=v.length!==0||S||i!==0||o;return o=S,i=v.length,T},this.beginShadows=function(){r=!0,b(null)},this.endShadows=function(){r=!1},this.setGlobalState=function(v,S){t=b(v,S,0)},this.setState=function(v,S,T){const B=v.clippingPlanes,y=v.clipIntersection,d=v.clipShadows,a=e.get(v);if(!o||B===null||B.length===0||r&&!d)r?b(null):M();else{const U=r?0:i,R=U*4;let g=a.clippingState||null;x.value=g,g=b(B,S,R,T);for(let O=0;O!==R;++O)g[O]=t[O];a.clippingState=g,this.numIntersection=y?this.numPlanes:0,this.numPlanes+=U}};function M(){x.value!==t&&(x.value=t,x.needsUpdate=i>0),n.numPlanes=i,n.numIntersection=0}function b(v,S,T,B){const y=v!==null?v.length:0;let d=null;if(y!==0){if(d=x.value,B!==!0||d===null){const a=T+y*4,U=S.matrixWorldInverse;f.getNormalMatrix(U),(d===null||d.length<a)&&(d=new Float32Array(a));for(let R=0,g=T;R!==y;++R,g+=4)p.copy(v[R]).applyMatrix4(U,f),p.normal.toArray(d,g),d[g+3]=p.constant}x.value=d,x.needsUpdate=!0}return n.numPlanes=y,n.numIntersection=0,d}}function xf(e){let n=new WeakMap;function t(p,f){return f===Pi?p.mapping=On:f===Li&&(p.mapping=Sn),p}function i(p){if(p&&p.isTexture){const f=p.mapping;if(f===Pi||f===Li)if(n.has(p)){const x=n.get(p).texture;return t(x,p.mapping)}else{const x=p.image;if(x&&x.height>0){const M=new $o(x.height);return M.fromEquirectangularTexture(e,p),n.set(p,M),p.addEventListener("dispose",o),t(M.texture,p.mapping)}else return null}}return p}function o(p){const f=p.target;f.removeEventListener("dispose",o);const x=n.get(f);x!==void 0&&(n.delete(f),x.dispose())}function r(){n=new WeakMap}return{get:i,dispose:r}}const _n=4,Fr=[.125,.215,.35,.446,.526,.582],nn=20,mi=new Jo,Br=new Ye;let _i=null,gi=0,vi=0,Ei=!1;const tn=(1+Math.sqrt(5))/2,dn=1/tn,Gr=[new Le(-tn,dn,0),new Le(tn,dn,0),new Le(-dn,0,tn),new Le(dn,0,tn),new Le(0,tn,-dn),new Le(0,tn,dn),new Le(-1,1,-1),new Le(1,1,-1),new Le(-1,1,1),new Le(1,1,1)],Af=new Le;class Hr{constructor(n){this._renderer=n,this._pingPongRenderTarget=null,this._lodMax=0,this._cubeSize=0,this._lodPlanes=[],this._sizeLods=[],this._sigmas=[],this._blurMaterial=null,this._cubemapMaterial=null,this._equirectMaterial=null,this._compileMaterial(this._blurMaterial)}fromScene(n,t=0,i=.1,o=100,r={}){const{size:p=256,position:f=Af}=r;_i=this._renderer.getRenderTarget(),gi=this._renderer.getActiveCubeFace(),vi=this._renderer.getActiveMipmapLevel(),Ei=this._renderer.xr.enabled,this._renderer.xr.enabled=!1,this._setSize(p);const x=this._allocateTargets();return x.depthBuffer=!0,this._sceneToCubeUV(n,i,o,x,f),t>0&&this._blur(x,0,0,t),this._applyPMREM(x),this._cleanup(x),x}fromEquirectangular(n,t=null){return this._fromTexture(n,t)}fromCubemap(n,t=null){return this._fromTexture(n,t)}compileCubemapShader(){this._cubemapMaterial===null&&(this._cubemapMaterial=Wr(),this._compileMaterial(this._cubemapMaterial))}compileEquirectangularShader(){this._equirectMaterial===null&&(this._equirectMaterial=kr(),this._compileMaterial(this._equirectMaterial))}dispose(){this._dispose(),this._cubemapMaterial!==null&&this._cubemapMaterial.dispose(),this._equirectMaterial!==null&&this._equirectMaterial.dispose()}_setSize(n){this._lodMax=Math.floor(Math.log2(n)),this._cubeSize=Math.pow(2,this._lodMax)}_dispose(){this._blurMaterial!==null&&this._blurMaterial.dispose(),this._pingPongRenderTarget!==null&&this._pingPongRenderTarget.dispose();for(let n=0;n<this._lodPlanes.length;n++)this._lodPlanes[n].dispose()}_cleanup(n){this._renderer.setRenderTarget(_i,gi,vi),this._renderer.xr.enabled=Ei,n.scissorTest=!1,Xn(n,0,0,n.width,n.height)}_fromTexture(n,t){n.mapping===On||n.mapping===Sn?this._setSize(n.image.length===0?16:n.image[0].width||n.image[0].image.width):this._setSize(n.image.width/4),_i=this._renderer.getRenderTarget(),gi=this._renderer.getActiveCubeFace(),vi=this._renderer.getActiveMipmapLevel(),Ei=this._renderer.xr.enabled,this._renderer.xr.enabled=!1;const i=t||this._allocateTargets();return this._textureToCubeUV(n,i),this._applyPMREM(i),this._cleanup(i),i}_allocateTargets(){const n=3*Math.max(this._cubeSize,112),t=4*this._cubeSize,i={magFilter:mn,minFilter:mn,generateMipmaps:!1,type:ni,format:Gt,colorSpace:ii,depthBuffer:!1},o=Vr(n,t,i);if(this._pingPongRenderTarget===null||this._pingPongRenderTarget.width!==n||this._pingPongRenderTarget.height!==t){this._pingPongRenderTarget!==null&&this._dispose(),this._pingPongRenderTarget=Vr(n,t,i);const{_lodMax:r}=this;({sizeLods:this._sizeLods,lodPlanes:this._lodPlanes,sigmas:this._sigmas}=Rf(r)),this._blurMaterial=Cf(r,n,t)}return o}_compileMaterial(n){const t=new We(this._lodPlanes[0],n);this._renderer.compile(t,mi)}_sceneToCubeUV(n,t,i,o,r){const x=new Dn(90,1,t,i),M=[1,-1,1,1,1,1],b=[1,1,1,-1,-1,-1],v=this._renderer,S=v.autoClear,T=v.toneMapping;v.getClearColor(Br),v.toneMapping=Zt,v.autoClear=!1,v.state.buffers.depth.getReversed()&&(v.setRenderTarget(o),v.clearDepth(),v.setRenderTarget(null));const y=new Yt({name:"PMREM.Background",side:Rt,depthWrite:!1,depthTest:!1}),d=new We(new $t,y);let a=!1;const U=n.background;U?U.isColor&&(y.color.copy(U),n.background=null,a=!0):(y.color.copy(Br),a=!0);for(let R=0;R<6;R++){const g=R%3;g===0?(x.up.set(0,M[R],0),x.position.set(r.x,r.y,r.z),x.lookAt(r.x+b[R],r.y,r.z)):g===1?(x.up.set(0,0,M[R]),x.position.set(r.x,r.y,r.z),x.lookAt(r.x,r.y+b[R],r.z)):(x.up.set(0,M[R],0),x.position.set(r.x,r.y,r.z),x.lookAt(r.x,r.y,r.z+b[R]));const O=this._cubeSize;Xn(o,g*O,R>2?O:0,O,O),v.setRenderTarget(o),a&&v.render(d,x),v.render(n,x)}d.geometry.dispose(),d.material.dispose(),v.toneMapping=T,v.autoClear=S,n.background=U}_textureToCubeUV(n,t){const i=this._renderer,o=n.mapping===On||n.mapping===Sn;o?(this._cubemapMaterial===null&&(this._cubemapMaterial=Wr()),this._cubemapMaterial.uniforms.flipEnvMap.value=n.isRenderTargetTexture===!1?-1:1):this._equirectMaterial===null&&(this._equirectMaterial=kr());const r=o?this._cubemapMaterial:this._equirectMaterial,p=new We(this._lodPlanes[0],r),f=r.uniforms;f.envMap.value=n;const x=this._cubeSize;Xn(t,0,0,3*x,2*x),i.setRenderTarget(t),i.render(p,mi)}_applyPMREM(n){const t=this._renderer,i=t.autoClear;t.autoClear=!1;const o=this._lodPlanes.length;for(let r=1;r<o;r++){const p=Math.sqrt(this._sigmas[r]*this._sigmas[r]-this._sigmas[r-1]*this._sigmas[r-1]),f=Gr[(o-r-1)%Gr.length];this._blur(n,r-1,r,p,f)}t.autoClear=i}_blur(n,t,i,o,r){const p=this._pingPongRenderTarget;this._halfBlur(n,p,t,i,o,"latitudinal",r),this._halfBlur(p,n,i,i,o,"longitudinal",r)}_halfBlur(n,t,i,o,r,p,f){const x=this._renderer,M=this._blurMaterial;p!=="latitudinal"&&p!=="longitudinal"&&console.error("blur direction must be either latitudinal or longitudinal!");const b=3,v=new We(this._lodPlanes[o],M),S=M.uniforms,T=this._sizeLods[i]-1,B=isFinite(r)?Math.PI/(2*T):2*Math.PI/(2*nn-1),y=r/B,d=isFinite(r)?1+Math.floor(b*y):nn;d>nn&&console.warn(`sigmaRadians, ${r}, is too large and will clip, as it requested ${d} samples when the maximum is set to ${nn}`);const a=[];let U=0;for(let D=0;D<nn;++D){const G=D/y,h=Math.exp(-G*G/2);a.push(h),D===0?U+=h:D<d&&(U+=2*h)}for(let D=0;D<a.length;D++)a[D]=a[D]/U;S.envMap.value=n.texture,S.samples.value=d,S.weights.value=a,S.latitudinal.value=p==="latitudinal",f&&(S.poleAxis.value=f);const{_lodMax:R}=this;S.dTheta.value=B,S.mipInt.value=R-i;const g=this._sizeLods[o],O=3*g*(o>R-_n?o-R+_n:0),P=4*(this._cubeSize-g);Xn(t,O,P,3*g,2*g),x.setRenderTarget(t),x.render(v,mi)}}function Rf(e){const n=[],t=[],i=[];let o=e;const r=e-_n+1+Fr.length;for(let p=0;p<r;p++){const f=Math.pow(2,o);t.push(f);let x=1/f;p>e-_n?x=Fr[p-e+_n-1]:p===0&&(x=0),i.push(x);const M=1/(f-2),b=-M,v=1+M,S=[b,b,v,b,v,v,b,b,v,v,b,v],T=6,B=6,y=3,d=2,a=1,U=new Float32Array(y*B*T),R=new Float32Array(d*B*T),g=new Float32Array(a*B*T);for(let P=0;P<T;P++){const D=P%3*2/3-1,G=P>2?0:-1,h=[D,G,0,D+2/3,G,0,D+2/3,G+1,0,D,G,0,D+2/3,G+1,0,D,G+1,0];U.set(h,y*B*P),R.set(S,d*B*P);const u=[P,P,P,P,P,P];g.set(u,a*B*P)}const O=new Bi;O.setAttribute("position",new Yn(U,y)),O.setAttribute("uv",new Yn(R,d)),O.setAttribute("faceIndex",new Yn(g,a)),n.push(O),o>_n&&o--}return{lodPlanes:n,sizeLods:t,sigmas:i}}function Vr(e,n,t){const i=new En(e,n,t);return i.texture.mapping=ri,i.texture.name="PMREM.cubeUv",i.scissorTest=!0,i}function Xn(e,n,t,i,o){e.viewport.set(n,t,i,o),e.scissor.set(n,t,i,o)}function Cf(e,n,t){const i=new Float32Array(nn),o=new Le(0,1,0);return new cn({name:"SphericalGaussianBlur",defines:{n:nn,CUBEUV_TEXEL_WIDTH:1/n,CUBEUV_TEXEL_HEIGHT:1/t,CUBEUV_MAX_MIP:`${e}.0`},uniforms:{envMap:{value:null},samples:{value:1},weights:{value:i},latitudinal:{value:!1},dTheta:{value:0},mipInt:{value:0},poleAxis:{value:o}},vertexShader:Hi(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;
			uniform int samples;
			uniform float weights[ n ];
			uniform bool latitudinal;
			uniform float dTheta;
			uniform float mipInt;
			uniform vec3 poleAxis;

			#define ENVMAP_TYPE_CUBE_UV
			#include <cube_uv_reflection_fragment>

			vec3 getSample( float theta, vec3 axis ) {

				float cosTheta = cos( theta );
				// Rodrigues' axis-angle rotation
				vec3 sampleDirection = vOutputDirection * cosTheta
					+ cross( axis, vOutputDirection ) * sin( theta )
					+ axis * dot( axis, vOutputDirection ) * ( 1.0 - cosTheta );

				return bilinearCubeUV( envMap, sampleDirection, mipInt );

			}

			void main() {

				vec3 axis = latitudinal ? poleAxis : cross( poleAxis, vOutputDirection );

				if ( all( equal( axis, vec3( 0.0 ) ) ) ) {

					axis = vec3( vOutputDirection.z, 0.0, - vOutputDirection.x );

				}

				axis = normalize( axis );

				gl_FragColor = vec4( 0.0, 0.0, 0.0, 1.0 );
				gl_FragColor.rgb += weights[ 0 ] * getSample( 0.0, axis );

				for ( int i = 1; i < n; i++ ) {

					if ( i >= samples ) {

						break;

					}

					float theta = dTheta * float( i );
					gl_FragColor.rgb += weights[ i ] * getSample( -1.0 * theta, axis );
					gl_FragColor.rgb += weights[ i ] * getSample( theta, axis );

				}

			}
		`,blending:on,depthTest:!1,depthWrite:!1})}function kr(){return new cn({name:"EquirectangularToCubeUV",uniforms:{envMap:{value:null}},vertexShader:Hi(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			varying vec3 vOutputDirection;

			uniform sampler2D envMap;

			#include <common>

			void main() {

				vec3 outputDirection = normalize( vOutputDirection );
				vec2 uv = equirectUv( outputDirection );

				gl_FragColor = vec4( texture2D ( envMap, uv ).rgb, 1.0 );

			}
		`,blending:on,depthTest:!1,depthWrite:!1})}function Wr(){return new cn({name:"CubemapToCubeUV",uniforms:{envMap:{value:null},flipEnvMap:{value:-1}},vertexShader:Hi(),fragmentShader:`

			precision mediump float;
			precision mediump int;

			uniform float flipEnvMap;

			varying vec3 vOutputDirection;

			uniform samplerCube envMap;

			void main() {

				gl_FragColor = textureCube( envMap, vec3( flipEnvMap * vOutputDirection.x, vOutputDirection.yz ) );

			}
		`,blending:on,depthTest:!1,depthWrite:!1})}function Hi(){return`

		precision mediump float;
		precision mediump int;

		attribute float faceIndex;

		varying vec3 vOutputDirection;

		// RH coordinate system; PMREM face-indexing convention
		vec3 getDirection( vec2 uv, float face ) {

			uv = 2.0 * uv - 1.0;

			vec3 direction = vec3( uv, 1.0 );

			if ( face == 0.0 ) {

				direction = direction.zyx; // ( 1, v, u ) pos x

			} else if ( face == 1.0 ) {

				direction = direction.xzy;
				direction.xz *= -1.0; // ( -u, 1, -v ) pos y

			} else if ( face == 2.0 ) {

				direction.x *= -1.0; // ( -u, v, 1 ) pos z

			} else if ( face == 3.0 ) {

				direction = direction.zyx;
				direction.xz *= -1.0; // ( -1, v, -u ) neg x

			} else if ( face == 4.0 ) {

				direction = direction.xzy;
				direction.xy *= -1.0; // ( -u, -1, v ) neg y

			} else if ( face == 5.0 ) {

				direction.z *= -1.0; // ( u, v, -1 ) neg z

			}

			return direction;

		}

		void main() {

			vOutputDirection = getDirection( uv, faceIndex );
			gl_Position = vec4( position, 1.0 );

		}
	`}function bf(e){let n=new WeakMap,t=null;function i(f){if(f&&f.isTexture){const x=f.mapping,M=x===Pi||x===Li,b=x===On||x===Sn;if(M||b){let v=n.get(f);const S=v!==void 0?v.texture.pmremVersion:0;if(f.isRenderTargetTexture&&f.pmremVersion!==S)return t===null&&(t=new Hr(e)),v=M?t.fromEquirectangular(f,v):t.fromCubemap(f,v),v.texture.pmremVersion=f.pmremVersion,n.set(f,v),v.texture;if(v!==void 0)return v.texture;{const T=f.image;return M&&T&&T.height>0||b&&T&&o(T)?(t===null&&(t=new Hr(e)),v=M?t.fromEquirectangular(f):t.fromCubemap(f),v.texture.pmremVersion=f.pmremVersion,n.set(f,v),f.addEventListener("dispose",r),v.texture):null}}}return f}function o(f){let x=0;const M=6;for(let b=0;b<M;b++)f[b]!==void 0&&x++;return x===M}function r(f){const x=f.target;x.removeEventListener("dispose",r);const M=n.get(x);M!==void 0&&(n.delete(x),M.dispose())}function p(){n=new WeakMap,t!==null&&(t.dispose(),t=null)}return{get:i,dispose:p}}function wf(e){const n={};function t(i){if(n[i]!==void 0)return n[i];let o;switch(i){case"WEBGL_depth_texture":o=e.getExtension("WEBGL_depth_texture")||e.getExtension("MOZ_WEBGL_depth_texture")||e.getExtension("WEBKIT_WEBGL_depth_texture");break;case"EXT_texture_filter_anisotropic":o=e.getExtension("EXT_texture_filter_anisotropic")||e.getExtension("MOZ_EXT_texture_filter_anisotropic")||e.getExtension("WEBKIT_EXT_texture_filter_anisotropic");break;case"WEBGL_compressed_texture_s3tc":o=e.getExtension("WEBGL_compressed_texture_s3tc")||e.getExtension("MOZ_WEBGL_compressed_texture_s3tc")||e.getExtension("WEBKIT_WEBGL_compressed_texture_s3tc");break;case"WEBGL_compressed_texture_pvrtc":o=e.getExtension("WEBGL_compressed_texture_pvrtc")||e.getExtension("WEBKIT_WEBGL_compressed_texture_pvrtc");break;default:o=e.getExtension(i)}return n[i]=o,o}return{has:function(i){return t(i)!==null},init:function(){t("EXT_color_buffer_float"),t("WEBGL_clip_cull_distance"),t("OES_texture_float_linear"),t("EXT_color_buffer_half_float"),t("WEBGL_multisampled_render_to_texture"),t("WEBGL_render_shared_exponent")},get:function(i){const o=t(i);return o===null&&Mi("THREE.WebGLRenderer: "+i+" extension not supported."),o}}}function Pf(e,n,t,i){const o={},r=new WeakMap;function p(v){const S=v.target;S.index!==null&&n.remove(S.index);for(const B in S.attributes)n.remove(S.attributes[B]);S.removeEventListener("dispose",p),delete o[S.id];const T=r.get(S);T&&(n.remove(T),r.delete(S)),i.releaseStatesOfGeometry(S),S.isInstancedBufferGeometry===!0&&delete S._maxInstanceCount,t.memory.geometries--}function f(v,S){return o[S.id]===!0||(S.addEventListener("dispose",p),o[S.id]=!0,t.memory.geometries++),S}function x(v){const S=v.attributes;for(const T in S)n.update(S[T],e.ARRAY_BUFFER)}function M(v){const S=[],T=v.index,B=v.attributes.position;let y=0;if(T!==null){const U=T.array;y=T.version;for(let R=0,g=U.length;R<g;R+=3){const O=U[R+0],P=U[R+1],D=U[R+2];S.push(O,P,P,D,D,O)}}else if(B!==void 0){const U=B.array;y=B.version;for(let R=0,g=U.length/3-1;R<g;R+=3){const O=R+0,P=R+1,D=R+2;S.push(O,P,P,D,D,O)}}else return;const d=new(ns(S)?es:ts)(S,1);d.version=y;const a=r.get(v);a&&n.remove(a),r.set(v,d)}function b(v){const S=r.get(v);if(S){const T=v.index;T!==null&&S.version<T.version&&M(v)}else M(v);return r.get(v)}return{get:f,update:x,getWireframeAttribute:b}}function Lf(e,n,t){let i;function o(S){i=S}let r,p;function f(S){r=S.type,p=S.bytesPerElement}function x(S,T){e.drawElements(i,T,r,S*p),t.update(T,i,1)}function M(S,T,B){B!==0&&(e.drawElementsInstanced(i,T,r,S*p,B),t.update(T,i,B))}function b(S,T,B){if(B===0)return;n.get("WEBGL_multi_draw").multiDrawElementsWEBGL(i,T,0,r,S,0,B);let d=0;for(let a=0;a<B;a++)d+=T[a];t.update(d,i,1)}function v(S,T,B,y){if(B===0)return;const d=n.get("WEBGL_multi_draw");if(d===null)for(let a=0;a<S.length;a++)M(S[a]/p,T[a],y[a]);else{d.multiDrawElementsInstancedWEBGL(i,T,0,r,S,0,y,0,B);let a=0;for(let U=0;U<B;U++)a+=T[U]*y[U];t.update(a,i,1)}}this.setMode=o,this.setIndex=f,this.render=x,this.renderInstances=M,this.renderMultiDraw=b,this.renderMultiDrawInstances=v}function Df(e){const n={geometries:0,textures:0},t={frame:0,calls:0,triangles:0,points:0,lines:0};function i(r,p,f){switch(t.calls++,p){case e.TRIANGLES:t.triangles+=f*(r/3);break;case e.LINES:t.lines+=f*(r/2);break;case e.LINE_STRIP:t.lines+=f*(r-1);break;case e.LINE_LOOP:t.lines+=f*r;break;case e.POINTS:t.points+=f*r;break;default:console.error("THREE.WebGLInfo: Unknown draw mode:",p);break}}function o(){t.calls=0,t.triangles=0,t.points=0,t.lines=0}return{memory:n,render:t,programs:null,autoReset:!0,reset:o,update:i}}function yf(e,n,t){const i=new WeakMap,o=new Tt;function r(p,f,x){const M=p.morphTargetInfluences,b=f.morphAttributes.position||f.morphAttributes.normal||f.morphAttributes.color,v=b!==void 0?b.length:0;let S=i.get(f);if(S===void 0||S.count!==v){let h=function(){D.dispose(),i.delete(f),f.removeEventListener("dispose",h)};S!==void 0&&S.texture.dispose();const T=f.morphAttributes.position!==void 0,B=f.morphAttributes.normal!==void 0,y=f.morphAttributes.color!==void 0,d=f.morphAttributes.position||[],a=f.morphAttributes.normal||[],U=f.morphAttributes.color||[];let R=0;T===!0&&(R=1),B===!0&&(R=2),y===!0&&(R=3);let g=f.attributes.position.count*R,O=1;g>n.maxTextureSize&&(O=Math.ceil(g/n.maxTextureSize),g=n.maxTextureSize);const P=new Float32Array(g*O*4*v),D=new Ea(P,g,O,v);D.type=an,D.needsUpdate=!0;const G=R*4;for(let u=0;u<v;u++){const A=d[u],F=a[u],W=U[u],K=g*O*4*u;for(let q=0;q<A.count;q++){const Y=q*G;T===!0&&(o.fromBufferAttribute(A,q),P[K+Y+0]=o.x,P[K+Y+1]=o.y,P[K+Y+2]=o.z,P[K+Y+3]=0),B===!0&&(o.fromBufferAttribute(F,q),P[K+Y+4]=o.x,P[K+Y+5]=o.y,P[K+Y+6]=o.z,P[K+Y+7]=0),y===!0&&(o.fromBufferAttribute(W,q),P[K+Y+8]=o.x,P[K+Y+9]=o.y,P[K+Y+10]=o.z,P[K+Y+11]=W.itemSize===4?o.w:1)}}S={count:v,texture:D,size:new gt(g,O)},i.set(f,S),f.addEventListener("dispose",h)}if(p.isInstancedMesh===!0&&p.morphTexture!==null)x.getUniforms().setValue(e,"morphTexture",p.morphTexture,t);else{let T=0;for(let y=0;y<M.length;y++)T+=M[y];const B=f.morphTargetsRelative?1:1-T;x.getUniforms().setValue(e,"morphTargetBaseInfluence",B),x.getUniforms().setValue(e,"morphTargetInfluences",M)}x.getUniforms().setValue(e,"morphTargetsTexture",S.texture,t),x.getUniforms().setValue(e,"morphTargetsTextureSize",S.size)}return{update:r}}function Uf(e,n,t,i){let o=new WeakMap;function r(x){const M=i.render.frame,b=x.geometry,v=n.get(x,b);if(o.get(v)!==M&&(n.update(v),o.set(v,M)),x.isInstancedMesh&&(x.hasEventListener("dispose",f)===!1&&x.addEventListener("dispose",f),o.get(x)!==M&&(t.update(x.instanceMatrix,e.ARRAY_BUFFER),x.instanceColor!==null&&t.update(x.instanceColor,e.ARRAY_BUFFER),o.set(x,M))),x.isSkinnedMesh){const S=x.skeleton;o.get(S)!==M&&(S.update(),o.set(S,M))}return v}function p(){o=new WeakMap}function f(x){const M=x.target;M.removeEventListener("dispose",f),t.remove(M.instanceMatrix),M.instanceColor!==null&&t.remove(M.instanceColor)}return{update:r,dispose:p}}const Da=new us,zr=new la(1,1),ya=new Ea,Ua=new ds,Ia=new fs,Xr=[],Kr=[],Yr=new Float32Array(16),qr=new Float32Array(9),$r=new Float32Array(4);function xn(e,n,t){const i=e[0];if(i<=0||i>0)return e;const o=n*t;let r=Xr[o];if(r===void 0&&(r=new Float32Array(o),Xr[o]=r),n!==0){i.toArray(r,0);for(let p=1,f=0;p!==n;++p)f+=t,e[p].toArray(r,f)}return r}function dt(e,n){if(e.length!==n.length)return!1;for(let t=0,i=e.length;t<i;t++)if(e[t]!==n[t])return!1;return!0}function ut(e,n){for(let t=0,i=n.length;t<i;t++)e[t]=n[t]}function ai(e,n){let t=Kr[n];t===void 0&&(t=new Int32Array(n),Kr[n]=t);for(let i=0;i!==n;++i)t[i]=e.allocateTextureUnit();return t}function If(e,n){const t=this.cache;t[0]!==n&&(e.uniform1f(this.addr,n),t[0]=n)}function Nf(e,n){const t=this.cache;if(n.x!==void 0)(t[0]!==n.x||t[1]!==n.y)&&(e.uniform2f(this.addr,n.x,n.y),t[0]=n.x,t[1]=n.y);else{if(dt(t,n))return;e.uniform2fv(this.addr,n),ut(t,n)}}function Of(e,n){const t=this.cache;if(n.x!==void 0)(t[0]!==n.x||t[1]!==n.y||t[2]!==n.z)&&(e.uniform3f(this.addr,n.x,n.y,n.z),t[0]=n.x,t[1]=n.y,t[2]=n.z);else if(n.r!==void 0)(t[0]!==n.r||t[1]!==n.g||t[2]!==n.b)&&(e.uniform3f(this.addr,n.r,n.g,n.b),t[0]=n.r,t[1]=n.g,t[2]=n.b);else{if(dt(t,n))return;e.uniform3fv(this.addr,n),ut(t,n)}}function Ff(e,n){const t=this.cache;if(n.x!==void 0)(t[0]!==n.x||t[1]!==n.y||t[2]!==n.z||t[3]!==n.w)&&(e.uniform4f(this.addr,n.x,n.y,n.z,n.w),t[0]=n.x,t[1]=n.y,t[2]=n.z,t[3]=n.w);else{if(dt(t,n))return;e.uniform4fv(this.addr,n),ut(t,n)}}function Bf(e,n){const t=this.cache,i=n.elements;if(i===void 0){if(dt(t,n))return;e.uniformMatrix2fv(this.addr,!1,n),ut(t,n)}else{if(dt(t,i))return;$r.set(i),e.uniformMatrix2fv(this.addr,!1,$r),ut(t,i)}}function Gf(e,n){const t=this.cache,i=n.elements;if(i===void 0){if(dt(t,n))return;e.uniformMatrix3fv(this.addr,!1,n),ut(t,n)}else{if(dt(t,i))return;qr.set(i),e.uniformMatrix3fv(this.addr,!1,qr),ut(t,i)}}function Hf(e,n){const t=this.cache,i=n.elements;if(i===void 0){if(dt(t,n))return;e.uniformMatrix4fv(this.addr,!1,n),ut(t,n)}else{if(dt(t,i))return;Yr.set(i),e.uniformMatrix4fv(this.addr,!1,Yr),ut(t,i)}}function Vf(e,n){const t=this.cache;t[0]!==n&&(e.uniform1i(this.addr,n),t[0]=n)}function kf(e,n){const t=this.cache;if(n.x!==void 0)(t[0]!==n.x||t[1]!==n.y)&&(e.uniform2i(this.addr,n.x,n.y),t[0]=n.x,t[1]=n.y);else{if(dt(t,n))return;e.uniform2iv(this.addr,n),ut(t,n)}}function Wf(e,n){const t=this.cache;if(n.x!==void 0)(t[0]!==n.x||t[1]!==n.y||t[2]!==n.z)&&(e.uniform3i(this.addr,n.x,n.y,n.z),t[0]=n.x,t[1]=n.y,t[2]=n.z);else{if(dt(t,n))return;e.uniform3iv(this.addr,n),ut(t,n)}}function zf(e,n){const t=this.cache;if(n.x!==void 0)(t[0]!==n.x||t[1]!==n.y||t[2]!==n.z||t[3]!==n.w)&&(e.uniform4i(this.addr,n.x,n.y,n.z,n.w),t[0]=n.x,t[1]=n.y,t[2]=n.z,t[3]=n.w);else{if(dt(t,n))return;e.uniform4iv(this.addr,n),ut(t,n)}}function Xf(e,n){const t=this.cache;t[0]!==n&&(e.uniform1ui(this.addr,n),t[0]=n)}function Kf(e,n){const t=this.cache;if(n.x!==void 0)(t[0]!==n.x||t[1]!==n.y)&&(e.uniform2ui(this.addr,n.x,n.y),t[0]=n.x,t[1]=n.y);else{if(dt(t,n))return;e.uniform2uiv(this.addr,n),ut(t,n)}}function Yf(e,n){const t=this.cache;if(n.x!==void 0)(t[0]!==n.x||t[1]!==n.y||t[2]!==n.z)&&(e.uniform3ui(this.addr,n.x,n.y,n.z),t[0]=n.x,t[1]=n.y,t[2]=n.z);else{if(dt(t,n))return;e.uniform3uiv(this.addr,n),ut(t,n)}}function qf(e,n){const t=this.cache;if(n.x!==void 0)(t[0]!==n.x||t[1]!==n.y||t[2]!==n.z||t[3]!==n.w)&&(e.uniform4ui(this.addr,n.x,n.y,n.z,n.w),t[0]=n.x,t[1]=n.y,t[2]=n.z,t[3]=n.w);else{if(dt(t,n))return;e.uniform4uiv(this.addr,n),ut(t,n)}}function $f(e,n,t){const i=this.cache,o=t.allocateTextureUnit();i[0]!==o&&(e.uniform1i(this.addr,o),i[0]=o);let r;this.type===e.SAMPLER_2D_SHADOW?(zr.compareFunction=fa,r=zr):r=Da,t.setTexture2D(n||r,o)}function Zf(e,n,t){const i=this.cache,o=t.allocateTextureUnit();i[0]!==o&&(e.uniform1i(this.addr,o),i[0]=o),t.setTexture3D(n||Ua,o)}function jf(e,n,t){const i=this.cache,o=t.allocateTextureUnit();i[0]!==o&&(e.uniform1i(this.addr,o),i[0]=o),t.setTextureCube(n||Ia,o)}function Qf(e,n,t){const i=this.cache,o=t.allocateTextureUnit();i[0]!==o&&(e.uniform1i(this.addr,o),i[0]=o),t.setTexture2DArray(n||ya,o)}function Jf(e){switch(e){case 5126:return If;case 35664:return Nf;case 35665:return Of;case 35666:return Ff;case 35674:return Bf;case 35675:return Gf;case 35676:return Hf;case 5124:case 35670:return Vf;case 35667:case 35671:return kf;case 35668:case 35672:return Wf;case 35669:case 35673:return zf;case 5125:return Xf;case 36294:return Kf;case 36295:return Yf;case 36296:return qf;case 35678:case 36198:case 36298:case 36306:case 35682:return $f;case 35679:case 36299:case 36307:return Zf;case 35680:case 36300:case 36308:case 36293:return jf;case 36289:case 36303:case 36311:case 36292:return Qf}}function ed(e,n){e.uniform1fv(this.addr,n)}function td(e,n){const t=xn(n,this.size,2);e.uniform2fv(this.addr,t)}function nd(e,n){const t=xn(n,this.size,3);e.uniform3fv(this.addr,t)}function id(e,n){const t=xn(n,this.size,4);e.uniform4fv(this.addr,t)}function rd(e,n){const t=xn(n,this.size,4);e.uniformMatrix2fv(this.addr,!1,t)}function ad(e,n){const t=xn(n,this.size,9);e.uniformMatrix3fv(this.addr,!1,t)}function od(e,n){const t=xn(n,this.size,16);e.uniformMatrix4fv(this.addr,!1,t)}function sd(e,n){e.uniform1iv(this.addr,n)}function cd(e,n){e.uniform2iv(this.addr,n)}function ld(e,n){e.uniform3iv(this.addr,n)}function fd(e,n){e.uniform4iv(this.addr,n)}function dd(e,n){e.uniform1uiv(this.addr,n)}function ud(e,n){e.uniform2uiv(this.addr,n)}function pd(e,n){e.uniform3uiv(this.addr,n)}function hd(e,n){e.uniform4uiv(this.addr,n)}function md(e,n,t){const i=this.cache,o=n.length,r=ai(t,o);dt(i,r)||(e.uniform1iv(this.addr,r),ut(i,r));for(let p=0;p!==o;++p)t.setTexture2D(n[p]||Da,r[p])}function _d(e,n,t){const i=this.cache,o=n.length,r=ai(t,o);dt(i,r)||(e.uniform1iv(this.addr,r),ut(i,r));for(let p=0;p!==o;++p)t.setTexture3D(n[p]||Ua,r[p])}function gd(e,n,t){const i=this.cache,o=n.length,r=ai(t,o);dt(i,r)||(e.uniform1iv(this.addr,r),ut(i,r));for(let p=0;p!==o;++p)t.setTextureCube(n[p]||Ia,r[p])}function vd(e,n,t){const i=this.cache,o=n.length,r=ai(t,o);dt(i,r)||(e.uniform1iv(this.addr,r),ut(i,r));for(let p=0;p!==o;++p)t.setTexture2DArray(n[p]||ya,r[p])}function Ed(e){switch(e){case 5126:return ed;case 35664:return td;case 35665:return nd;case 35666:return id;case 35674:return rd;case 35675:return ad;case 35676:return od;case 5124:case 35670:return sd;case 35667:case 35671:return cd;case 35668:case 35672:return ld;case 35669:case 35673:return fd;case 5125:return dd;case 36294:return ud;case 36295:return pd;case 36296:return hd;case 35678:case 36198:case 36298:case 36306:case 35682:return md;case 35679:case 36299:case 36307:return _d;case 35680:case 36300:case 36308:case 36293:return gd;case 36289:case 36303:case 36311:case 36292:return vd}}class Sd{constructor(n,t,i){this.id=n,this.addr=i,this.cache=[],this.type=t.type,this.setValue=Jf(t.type)}}class Md{constructor(n,t,i){this.id=n,this.addr=i,this.cache=[],this.type=t.type,this.size=t.size,this.setValue=Ed(t.type)}}class Td{constructor(n){this.id=n,this.seq=[],this.map={}}setValue(n,t,i){const o=this.seq;for(let r=0,p=o.length;r!==p;++r){const f=o[r];f.setValue(n,t[f.id],i)}}}const Si=/(\w+)(\])?(\[|\.)?/g;function Zr(e,n){e.seq.push(n),e.map[n.id]=n}function xd(e,n,t){const i=e.name,o=i.length;for(Si.lastIndex=0;;){const r=Si.exec(i),p=Si.lastIndex;let f=r[1];const x=r[2]==="]",M=r[3];if(x&&(f=f|0),M===void 0||M==="["&&p+2===o){Zr(t,M===void 0?new Sd(f,e,n):new Md(f,e,n));break}else{let v=t.map[f];v===void 0&&(v=new Td(f),Zr(t,v)),t=v}}}class $n{constructor(n,t){this.seq=[],this.map={};const i=n.getProgramParameter(t,n.ACTIVE_UNIFORMS);for(let o=0;o<i;++o){const r=n.getActiveUniform(t,o),p=n.getUniformLocation(t,r.name);xd(r,p,this)}}setValue(n,t,i,o){const r=this.map[t];r!==void 0&&r.setValue(n,i,o)}setOptional(n,t,i){const o=t[i];o!==void 0&&this.setValue(n,i,o)}static upload(n,t,i,o){for(let r=0,p=t.length;r!==p;++r){const f=t[r],x=i[f.id];x.needsUpdate!==!1&&f.setValue(n,x.value,o)}}static seqWithValue(n,t){const i=[];for(let o=0,r=n.length;o!==r;++o){const p=n[o];p.id in t&&i.push(p)}return i}}function jr(e,n,t){const i=e.createShader(n);return e.shaderSource(i,t),e.compileShader(i),i}const Ad=37297;let Rd=0;function Cd(e,n){const t=e.split(`
`),i=[],o=Math.max(n-6,0),r=Math.min(n+6,t.length);for(let p=o;p<r;p++){const f=p+1;i.push(`${f===n?">":" "} ${f}: ${t[p]}`)}return i.join(`
`)}const Qr=new ke;function bd(e){ft._getMatrix(Qr,ft.workingColorSpace,e);const n=`mat3( ${Qr.elements.map(t=>t.toFixed(4))} )`;switch(ft.getTransfer(e)){case Ma:return[n,"LinearTransferOETF"];case Qe:return[n,"sRGBTransferOETF"];default:return console.warn("THREE.WebGLProgram: Unsupported color space: ",e),[n,"LinearTransferOETF"]}}function Jr(e,n,t){const i=e.getShaderParameter(n,e.COMPILE_STATUS),r=(e.getShaderInfoLog(n)||"").trim();if(i&&r==="")return"";const p=/ERROR: 0:(\d+)/.exec(r);if(p){const f=parseInt(p[1]);return t.toUpperCase()+`

`+r+`

`+Cd(e.getShaderSource(n),f)}else return r}function wd(e,n){const t=bd(n);return[`vec4 ${e}( vec4 value ) {`,`	return ${t[1]}( vec4( value.rgb * ${t[0]}, value.a ) );`,"}"].join(`
`)}function Pd(e,n){let t;switch(n){case ls:t="Linear";break;case cs:t="Reinhard";break;case ss:t="Cineon";break;case xa:t="ACESFilmic";break;case os:t="AgX";break;case as:t="Neutral";break;case rs:t="Custom";break;default:console.warn("THREE.WebGLProgram: Unsupported toneMapping:",n),t="Linear"}return"vec3 "+e+"( vec3 color ) { return "+t+"ToneMapping( color ); }"}const Kn=new Le;function Ld(){ft.getLuminanceCoefficients(Kn);const e=Kn.x.toFixed(4),n=Kn.y.toFixed(4),t=Kn.z.toFixed(4);return["float luminance( const in vec3 rgb ) {",`	const vec3 weights = vec3( ${e}, ${n}, ${t} );`,"	return dot( weights, rgb );","}"].join(`
`)}function Dd(e){return[e.extensionClipCullDistance?"#extension GL_ANGLE_clip_cull_distance : require":"",e.extensionMultiDraw?"#extension GL_ANGLE_multi_draw : require":""].filter(Pn).join(`
`)}function yd(e){const n=[];for(const t in e){const i=e[t];i!==!1&&n.push("#define "+t+" "+i)}return n.join(`
`)}function Ud(e,n){const t={},i=e.getProgramParameter(n,e.ACTIVE_ATTRIBUTES);for(let o=0;o<i;o++){const r=e.getActiveAttrib(n,o),p=r.name;let f=1;r.type===e.FLOAT_MAT2&&(f=2),r.type===e.FLOAT_MAT3&&(f=3),r.type===e.FLOAT_MAT4&&(f=4),t[p]={type:r.type,location:e.getAttribLocation(n,p),locationSize:f}}return t}function Pn(e){return e!==""}function ea(e,n){const t=n.numSpotLightShadows+n.numSpotLightMaps-n.numSpotLightShadowsWithMaps;return e.replace(/NUM_DIR_LIGHTS/g,n.numDirLights).replace(/NUM_SPOT_LIGHTS/g,n.numSpotLights).replace(/NUM_SPOT_LIGHT_MAPS/g,n.numSpotLightMaps).replace(/NUM_SPOT_LIGHT_COORDS/g,t).replace(/NUM_RECT_AREA_LIGHTS/g,n.numRectAreaLights).replace(/NUM_POINT_LIGHTS/g,n.numPointLights).replace(/NUM_HEMI_LIGHTS/g,n.numHemiLights).replace(/NUM_DIR_LIGHT_SHADOWS/g,n.numDirLightShadows).replace(/NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS/g,n.numSpotLightShadowsWithMaps).replace(/NUM_SPOT_LIGHT_SHADOWS/g,n.numSpotLightShadows).replace(/NUM_POINT_LIGHT_SHADOWS/g,n.numPointLightShadows)}function ta(e,n){return e.replace(/NUM_CLIPPING_PLANES/g,n.numClippingPlanes).replace(/UNION_CLIPPING_PLANES/g,n.numClippingPlanes-n.numClipIntersection)}const Id=/^[ \t]*#include +<([\w\d./]+)>/gm;function yi(e){return e.replace(Id,Od)}const Nd=new Map;function Od(e,n){let t=Be[n];if(t===void 0){const i=Nd.get(n);if(i!==void 0)t=Be[i],console.warn('THREE.WebGLRenderer: Shader chunk "%s" has been deprecated. Use "%s" instead.',n,i);else throw new Error("Can not resolve #include <"+n+">")}return yi(t)}const Fd=/#pragma unroll_loop_start\s+for\s*\(\s*int\s+i\s*=\s*(\d+)\s*;\s*i\s*<\s*(\d+)\s*;\s*i\s*\+\+\s*\)\s*{([\s\S]+?)}\s+#pragma unroll_loop_end/g;function na(e){return e.replace(Fd,Bd)}function Bd(e,n,t,i){let o="";for(let r=parseInt(n);r<parseInt(t);r++)o+=i.replace(/\[\s*i\s*\]/g,"[ "+r+" ]").replace(/UNROLLED_LOOP_INDEX/g,r);return o}function ia(e){let n=`precision ${e.precision} float;
	precision ${e.precision} int;
	precision ${e.precision} sampler2D;
	precision ${e.precision} samplerCube;
	precision ${e.precision} sampler3D;
	precision ${e.precision} sampler2DArray;
	precision ${e.precision} sampler2DShadow;
	precision ${e.precision} samplerCubeShadow;
	precision ${e.precision} sampler2DArrayShadow;
	precision ${e.precision} isampler2D;
	precision ${e.precision} isampler3D;
	precision ${e.precision} isamplerCube;
	precision ${e.precision} isampler2DArray;
	precision ${e.precision} usampler2D;
	precision ${e.precision} usampler3D;
	precision ${e.precision} usamplerCube;
	precision ${e.precision} usampler2DArray;
	`;return e.precision==="highp"?n+=`
#define HIGH_PRECISION`:e.precision==="mediump"?n+=`
#define MEDIUM_PRECISION`:e.precision==="lowp"&&(n+=`
#define LOW_PRECISION`),n}function Gd(e){let n="SHADOWMAP_TYPE_BASIC";return e.shadowMapType===da?n="SHADOWMAP_TYPE_PCF":e.shadowMapType===Ta?n="SHADOWMAP_TYPE_PCF_SOFT":e.shadowMapType===Bt&&(n="SHADOWMAP_TYPE_VSM"),n}function Hd(e){let n="ENVMAP_TYPE_CUBE";if(e.envMap)switch(e.envMapMode){case On:case Sn:n="ENVMAP_TYPE_CUBE";break;case ri:n="ENVMAP_TYPE_CUBE_UV";break}return n}function Vd(e){let n="ENVMAP_MODE_REFLECTION";return e.envMap&&e.envMapMode===Sn&&(n="ENVMAP_MODE_REFRACTION"),n}function kd(e){let n="ENVMAP_BLENDING_NONE";if(e.envMap)switch(e.combine){case _s:n="ENVMAP_BLENDING_MULTIPLY";break;case ms:n="ENVMAP_BLENDING_MIX";break;case hs:n="ENVMAP_BLENDING_ADD";break}return n}function Wd(e){const n=e.envMapCubeUVHeight;if(n===null)return null;const t=Math.log2(n)-2,i=1/n;return{texelWidth:1/(3*Math.max(Math.pow(2,t),112)),texelHeight:i,maxMip:t}}function zd(e,n,t,i){const o=e.getContext(),r=t.defines;let p=t.vertexShader,f=t.fragmentShader;const x=Gd(t),M=Hd(t),b=Vd(t),v=kd(t),S=Wd(t),T=Dd(t),B=yd(r),y=o.createProgram();let d,a,U=t.glslVersion?"#version "+t.glslVersion+`
`:"";t.isRawShaderMaterial?(d=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,B].filter(Pn).join(`
`),d.length>0&&(d+=`
`),a=["#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,B].filter(Pn).join(`
`),a.length>0&&(a+=`
`)):(d=[ia(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,B,t.extensionClipCullDistance?"#define USE_CLIP_DISTANCE":"",t.batching?"#define USE_BATCHING":"",t.batchingColor?"#define USE_BATCHING_COLOR":"",t.instancing?"#define USE_INSTANCING":"",t.instancingColor?"#define USE_INSTANCING_COLOR":"",t.instancingMorph?"#define USE_INSTANCING_MORPH":"",t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.map?"#define USE_MAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+b:"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.displacementMap?"#define USE_DISPLACEMENTMAP":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.mapUv?"#define MAP_UV "+t.mapUv:"",t.alphaMapUv?"#define ALPHAMAP_UV "+t.alphaMapUv:"",t.lightMapUv?"#define LIGHTMAP_UV "+t.lightMapUv:"",t.aoMapUv?"#define AOMAP_UV "+t.aoMapUv:"",t.emissiveMapUv?"#define EMISSIVEMAP_UV "+t.emissiveMapUv:"",t.bumpMapUv?"#define BUMPMAP_UV "+t.bumpMapUv:"",t.normalMapUv?"#define NORMALMAP_UV "+t.normalMapUv:"",t.displacementMapUv?"#define DISPLACEMENTMAP_UV "+t.displacementMapUv:"",t.metalnessMapUv?"#define METALNESSMAP_UV "+t.metalnessMapUv:"",t.roughnessMapUv?"#define ROUGHNESSMAP_UV "+t.roughnessMapUv:"",t.anisotropyMapUv?"#define ANISOTROPYMAP_UV "+t.anisotropyMapUv:"",t.clearcoatMapUv?"#define CLEARCOATMAP_UV "+t.clearcoatMapUv:"",t.clearcoatNormalMapUv?"#define CLEARCOAT_NORMALMAP_UV "+t.clearcoatNormalMapUv:"",t.clearcoatRoughnessMapUv?"#define CLEARCOAT_ROUGHNESSMAP_UV "+t.clearcoatRoughnessMapUv:"",t.iridescenceMapUv?"#define IRIDESCENCEMAP_UV "+t.iridescenceMapUv:"",t.iridescenceThicknessMapUv?"#define IRIDESCENCE_THICKNESSMAP_UV "+t.iridescenceThicknessMapUv:"",t.sheenColorMapUv?"#define SHEEN_COLORMAP_UV "+t.sheenColorMapUv:"",t.sheenRoughnessMapUv?"#define SHEEN_ROUGHNESSMAP_UV "+t.sheenRoughnessMapUv:"",t.specularMapUv?"#define SPECULARMAP_UV "+t.specularMapUv:"",t.specularColorMapUv?"#define SPECULAR_COLORMAP_UV "+t.specularColorMapUv:"",t.specularIntensityMapUv?"#define SPECULAR_INTENSITYMAP_UV "+t.specularIntensityMapUv:"",t.transmissionMapUv?"#define TRANSMISSIONMAP_UV "+t.transmissionMapUv:"",t.thicknessMapUv?"#define THICKNESSMAP_UV "+t.thicknessMapUv:"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexColors?"#define USE_COLOR":"",t.vertexAlphas?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.flatShading?"#define FLAT_SHADED":"",t.skinning?"#define USE_SKINNING":"",t.morphTargets?"#define USE_MORPHTARGETS":"",t.morphNormals&&t.flatShading===!1?"#define USE_MORPHNORMALS":"",t.morphColors?"#define USE_MORPHCOLORS":"",t.morphTargetsCount>0?"#define MORPHTARGETS_TEXTURE_STRIDE "+t.morphTextureStride:"",t.morphTargetsCount>0?"#define MORPHTARGETS_COUNT "+t.morphTargetsCount:"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+x:"",t.sizeAttenuation?"#define USE_SIZEATTENUATION":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",t.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 modelMatrix;","uniform mat4 modelViewMatrix;","uniform mat4 projectionMatrix;","uniform mat4 viewMatrix;","uniform mat3 normalMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;","#ifdef USE_INSTANCING","	attribute mat4 instanceMatrix;","#endif","#ifdef USE_INSTANCING_COLOR","	attribute vec3 instanceColor;","#endif","#ifdef USE_INSTANCING_MORPH","	uniform sampler2D morphTexture;","#endif","attribute vec3 position;","attribute vec3 normal;","attribute vec2 uv;","#ifdef USE_UV1","	attribute vec2 uv1;","#endif","#ifdef USE_UV2","	attribute vec2 uv2;","#endif","#ifdef USE_UV3","	attribute vec2 uv3;","#endif","#ifdef USE_TANGENT","	attribute vec4 tangent;","#endif","#if defined( USE_COLOR_ALPHA )","	attribute vec4 color;","#elif defined( USE_COLOR )","	attribute vec3 color;","#endif","#ifdef USE_SKINNING","	attribute vec4 skinIndex;","	attribute vec4 skinWeight;","#endif",`
`].filter(Pn).join(`
`),a=[ia(t),"#define SHADER_TYPE "+t.shaderType,"#define SHADER_NAME "+t.shaderName,B,t.useFog&&t.fog?"#define USE_FOG":"",t.useFog&&t.fogExp2?"#define FOG_EXP2":"",t.alphaToCoverage?"#define ALPHA_TO_COVERAGE":"",t.map?"#define USE_MAP":"",t.matcap?"#define USE_MATCAP":"",t.envMap?"#define USE_ENVMAP":"",t.envMap?"#define "+M:"",t.envMap?"#define "+b:"",t.envMap?"#define "+v:"",S?"#define CUBEUV_TEXEL_WIDTH "+S.texelWidth:"",S?"#define CUBEUV_TEXEL_HEIGHT "+S.texelHeight:"",S?"#define CUBEUV_MAX_MIP "+S.maxMip+".0":"",t.lightMap?"#define USE_LIGHTMAP":"",t.aoMap?"#define USE_AOMAP":"",t.bumpMap?"#define USE_BUMPMAP":"",t.normalMap?"#define USE_NORMALMAP":"",t.normalMapObjectSpace?"#define USE_NORMALMAP_OBJECTSPACE":"",t.normalMapTangentSpace?"#define USE_NORMALMAP_TANGENTSPACE":"",t.emissiveMap?"#define USE_EMISSIVEMAP":"",t.anisotropy?"#define USE_ANISOTROPY":"",t.anisotropyMap?"#define USE_ANISOTROPYMAP":"",t.clearcoat?"#define USE_CLEARCOAT":"",t.clearcoatMap?"#define USE_CLEARCOATMAP":"",t.clearcoatRoughnessMap?"#define USE_CLEARCOAT_ROUGHNESSMAP":"",t.clearcoatNormalMap?"#define USE_CLEARCOAT_NORMALMAP":"",t.dispersion?"#define USE_DISPERSION":"",t.iridescence?"#define USE_IRIDESCENCE":"",t.iridescenceMap?"#define USE_IRIDESCENCEMAP":"",t.iridescenceThicknessMap?"#define USE_IRIDESCENCE_THICKNESSMAP":"",t.specularMap?"#define USE_SPECULARMAP":"",t.specularColorMap?"#define USE_SPECULAR_COLORMAP":"",t.specularIntensityMap?"#define USE_SPECULAR_INTENSITYMAP":"",t.roughnessMap?"#define USE_ROUGHNESSMAP":"",t.metalnessMap?"#define USE_METALNESSMAP":"",t.alphaMap?"#define USE_ALPHAMAP":"",t.alphaTest?"#define USE_ALPHATEST":"",t.alphaHash?"#define USE_ALPHAHASH":"",t.sheen?"#define USE_SHEEN":"",t.sheenColorMap?"#define USE_SHEEN_COLORMAP":"",t.sheenRoughnessMap?"#define USE_SHEEN_ROUGHNESSMAP":"",t.transmission?"#define USE_TRANSMISSION":"",t.transmissionMap?"#define USE_TRANSMISSIONMAP":"",t.thicknessMap?"#define USE_THICKNESSMAP":"",t.vertexTangents&&t.flatShading===!1?"#define USE_TANGENT":"",t.vertexColors||t.instancingColor||t.batchingColor?"#define USE_COLOR":"",t.vertexAlphas?"#define USE_COLOR_ALPHA":"",t.vertexUv1s?"#define USE_UV1":"",t.vertexUv2s?"#define USE_UV2":"",t.vertexUv3s?"#define USE_UV3":"",t.pointsUvs?"#define USE_POINTS_UV":"",t.gradientMap?"#define USE_GRADIENTMAP":"",t.flatShading?"#define FLAT_SHADED":"",t.doubleSided?"#define DOUBLE_SIDED":"",t.flipSided?"#define FLIP_SIDED":"",t.shadowMapEnabled?"#define USE_SHADOWMAP":"",t.shadowMapEnabled?"#define "+x:"",t.premultipliedAlpha?"#define PREMULTIPLIED_ALPHA":"",t.numLightProbes>0?"#define USE_LIGHT_PROBES":"",t.decodeVideoTexture?"#define DECODE_VIDEO_TEXTURE":"",t.decodeVideoTextureEmissive?"#define DECODE_VIDEO_TEXTURE_EMISSIVE":"",t.logarithmicDepthBuffer?"#define USE_LOGARITHMIC_DEPTH_BUFFER":"",t.reversedDepthBuffer?"#define USE_REVERSED_DEPTH_BUFFER":"","uniform mat4 viewMatrix;","uniform vec3 cameraPosition;","uniform bool isOrthographic;",t.toneMapping!==Zt?"#define TONE_MAPPING":"",t.toneMapping!==Zt?Be.tonemapping_pars_fragment:"",t.toneMapping!==Zt?Pd("toneMapping",t.toneMapping):"",t.dithering?"#define DITHERING":"",t.opaque?"#define OPAQUE":"",Be.colorspace_pars_fragment,wd("linearToOutputTexel",t.outputColorSpace),Ld(),t.useDepthPacking?"#define DEPTH_PACKING "+t.depthPacking:"",`
`].filter(Pn).join(`
`)),p=yi(p),p=ea(p,t),p=ta(p,t),f=yi(f),f=ea(f,t),f=ta(f,t),p=na(p),f=na(f),t.isRawShaderMaterial!==!0&&(U=`#version 300 es
`,d=[T,"#define attribute in","#define varying out","#define texture2D texture"].join(`
`)+`
`+d,a=["#define varying in",t.glslVersion===Ur?"":"layout(location = 0) out highp vec4 pc_fragColor;",t.glslVersion===Ur?"":"#define gl_FragColor pc_fragColor","#define gl_FragDepthEXT gl_FragDepth","#define texture2D texture","#define textureCube texture","#define texture2DProj textureProj","#define texture2DLodEXT textureLod","#define texture2DProjLodEXT textureProjLod","#define textureCubeLodEXT textureLod","#define texture2DGradEXT textureGrad","#define texture2DProjGradEXT textureProjGrad","#define textureCubeGradEXT textureGrad"].join(`
`)+`
`+a);const R=U+d+p,g=U+a+f,O=jr(o,o.VERTEX_SHADER,R),P=jr(o,o.FRAGMENT_SHADER,g);o.attachShader(y,O),o.attachShader(y,P),t.index0AttributeName!==void 0?o.bindAttribLocation(y,0,t.index0AttributeName):t.morphTargets===!0&&o.bindAttribLocation(y,0,"position"),o.linkProgram(y);function D(A){if(e.debug.checkShaderErrors){const F=o.getProgramInfoLog(y)||"",W=o.getShaderInfoLog(O)||"",K=o.getShaderInfoLog(P)||"",q=F.trim(),Y=W.trim(),re=K.trim();let k=!0,Ee=!0;if(o.getProgramParameter(y,o.LINK_STATUS)===!1)if(k=!1,typeof e.debug.onShaderError=="function")e.debug.onShaderError(o,y,O,P);else{const Ae=Jr(o,O,"vertex"),Oe=Jr(o,P,"fragment");console.error("THREE.WebGLProgram: Shader Error "+o.getError()+" - VALIDATE_STATUS "+o.getProgramParameter(y,o.VALIDATE_STATUS)+`

Material Name: `+A.name+`
Material Type: `+A.type+`

Program Info Log: `+q+`
`+Ae+`
`+Oe)}else q!==""?console.warn("THREE.WebGLProgram: Program Info Log:",q):(Y===""||re==="")&&(Ee=!1);Ee&&(A.diagnostics={runnable:k,programLog:q,vertexShader:{log:Y,prefix:d},fragmentShader:{log:re,prefix:a}})}o.deleteShader(O),o.deleteShader(P),G=new $n(o,y),h=Ud(o,y)}let G;this.getUniforms=function(){return G===void 0&&D(this),G};let h;this.getAttributes=function(){return h===void 0&&D(this),h};let u=t.rendererExtensionParallelShaderCompile===!1;return this.isReady=function(){return u===!1&&(u=o.getProgramParameter(y,Ad)),u},this.destroy=function(){i.releaseStatesOfProgram(this),o.deleteProgram(y),this.program=void 0},this.type=t.shaderType,this.name=t.shaderName,this.id=Rd++,this.cacheKey=n,this.usedTimes=1,this.program=y,this.vertexShader=O,this.fragmentShader=P,this}let Xd=0;class Kd{constructor(){this.shaderCache=new Map,this.materialCache=new Map}update(n){const t=n.vertexShader,i=n.fragmentShader,o=this._getShaderStage(t),r=this._getShaderStage(i),p=this._getShaderCacheForMaterial(n);return p.has(o)===!1&&(p.add(o),o.usedTimes++),p.has(r)===!1&&(p.add(r),r.usedTimes++),this}remove(n){const t=this.materialCache.get(n);for(const i of t)i.usedTimes--,i.usedTimes===0&&this.shaderCache.delete(i.code);return this.materialCache.delete(n),this}getVertexShaderID(n){return this._getShaderStage(n.vertexShader).id}getFragmentShaderID(n){return this._getShaderStage(n.fragmentShader).id}dispose(){this.shaderCache.clear(),this.materialCache.clear()}_getShaderCacheForMaterial(n){const t=this.materialCache;let i=t.get(n);return i===void 0&&(i=new Set,t.set(n,i)),i}_getShaderStage(n){const t=this.shaderCache;let i=t.get(n);return i===void 0&&(i=new Yd(n),t.set(n,i)),i}}class Yd{constructor(n){this.id=Xd++,this.code=n,this.usedTimes=0}}function qd(e,n,t,i,o,r,p){const f=new is,x=new Kd,M=new Set,b=[],v=o.logarithmicDepthBuffer,S=o.vertexTextures;let T=o.precision;const B={MeshDepthMaterial:"depth",MeshDistanceMaterial:"distanceRGBA",MeshNormalMaterial:"normal",MeshBasicMaterial:"basic",MeshLambertMaterial:"lambert",MeshPhongMaterial:"phong",MeshToonMaterial:"toon",MeshStandardMaterial:"physical",MeshPhysicalMaterial:"physical",MeshMatcapMaterial:"matcap",LineBasicMaterial:"basic",LineDashedMaterial:"dashed",PointsMaterial:"points",ShadowMaterial:"shadow",SpriteMaterial:"sprite"};function y(h){return M.add(h),h===0?"uv":`uv${h}`}function d(h,u,A,F,W){const K=F.fog,q=W.geometry,Y=h.isMeshStandardMaterial?F.environment:null,re=(h.isMeshStandardMaterial?t:n).get(h.envMap||Y),k=re&&re.mapping===ri?re.image.height:null,Ee=B[h.type];h.precision!==null&&(T=o.getMaxPrecision(h.precision),T!==h.precision&&console.warn("THREE.WebGLProgram.getParameters:",h.precision,"not supported, using",T,"instead."));const Ae=q.morphAttributes.position||q.morphAttributes.normal||q.morphAttributes.color,Oe=Ae!==void 0?Ae.length:0;let ze=0;q.morphAttributes.position!==void 0&&(ze=1),q.morphAttributes.normal!==void 0&&(ze=2),q.morphAttributes.color!==void 0&&(ze=3);let st,rt,qe,z;if(Ee){const Xe=It[Ee];st=Xe.vertexShader,rt=Xe.fragmentShader}else st=h.vertexShader,rt=h.fragmentShader,x.update(h),qe=x.getVertexShaderID(h),z=x.getFragmentShaderID(h);const Z=e.getRenderTarget(),de=e.state.buffers.depth.getReversed(),De=W.isInstancedMesh===!0,Me=W.isBatchedMesh===!0,He=!!h.map,mt=!!h.matcap,_=!!re,Je=!!h.aoMap,Ue=!!h.lightMap,we=!!h.bumpMap,he=!!h.normalMap,et=!!h.displacementMap,me=!!h.emissiveMap,Fe=!!h.metalnessMap,pt=!!h.roughnessMap,ct=h.anisotropy>0,m=h.clearcoat>0,s=h.dispersion>0,L=h.iridescence>0,V=h.sheen>0,$=h.transmission>0,H=ct&&!!h.anisotropyMap,Se=m&&!!h.clearcoatMap,te=m&&!!h.clearcoatNormalMap,_e=m&&!!h.clearcoatRoughnessMap,ge=L&&!!h.iridescenceMap,J=L&&!!h.iridescenceThicknessMap,ce=V&&!!h.sheenColorMap,Ce=V&&!!h.sheenRoughnessMap,ve=!!h.specularMap,oe=!!h.specularColorMap,Ne=!!h.specularIntensityMap,E=$&&!!h.transmissionMap,ee=$&&!!h.thicknessMap,ne=!!h.gradientMap,fe=!!h.alphaMap,j=h.alphaTest>0,X=!!h.alphaHash,pe=!!h.extensions;let ye=Zt;h.toneMapped&&(Z===null||Z.isXRRenderTarget===!0)&&(ye=e.toneMapping);const Ze={shaderID:Ee,shaderType:h.type,shaderName:h.name,vertexShader:st,fragmentShader:rt,defines:h.defines,customVertexShaderID:qe,customFragmentShaderID:z,isRawShaderMaterial:h.isRawShaderMaterial===!0,glslVersion:h.glslVersion,precision:T,batching:Me,batchingColor:Me&&W._colorsTexture!==null,instancing:De,instancingColor:De&&W.instanceColor!==null,instancingMorph:De&&W.morphTexture!==null,supportsVertexTextures:S,outputColorSpace:Z===null?e.outputColorSpace:Z.isXRRenderTarget===!0?Z.texture.colorSpace:ii,alphaToCoverage:!!h.alphaToCoverage,map:He,matcap:mt,envMap:_,envMapMode:_&&re.mapping,envMapCubeUVHeight:k,aoMap:Je,lightMap:Ue,bumpMap:we,normalMap:he,displacementMap:S&&et,emissiveMap:me,normalMapObjectSpace:he&&h.normalMapType===Qo,normalMapTangentSpace:he&&h.normalMapType===jo,metalnessMap:Fe,roughnessMap:pt,anisotropy:ct,anisotropyMap:H,clearcoat:m,clearcoatMap:Se,clearcoatNormalMap:te,clearcoatRoughnessMap:_e,dispersion:s,iridescence:L,iridescenceMap:ge,iridescenceThicknessMap:J,sheen:V,sheenColorMap:ce,sheenRoughnessMap:Ce,specularMap:ve,specularColorMap:oe,specularIntensityMap:Ne,transmission:$,transmissionMap:E,thicknessMap:ee,gradientMap:ne,opaque:h.transparent===!1&&h.blending===qn&&h.alphaToCoverage===!1,alphaMap:fe,alphaTest:j,alphaHash:X,combine:h.combine,mapUv:He&&y(h.map.channel),aoMapUv:Je&&y(h.aoMap.channel),lightMapUv:Ue&&y(h.lightMap.channel),bumpMapUv:we&&y(h.bumpMap.channel),normalMapUv:he&&y(h.normalMap.channel),displacementMapUv:et&&y(h.displacementMap.channel),emissiveMapUv:me&&y(h.emissiveMap.channel),metalnessMapUv:Fe&&y(h.metalnessMap.channel),roughnessMapUv:pt&&y(h.roughnessMap.channel),anisotropyMapUv:H&&y(h.anisotropyMap.channel),clearcoatMapUv:Se&&y(h.clearcoatMap.channel),clearcoatNormalMapUv:te&&y(h.clearcoatNormalMap.channel),clearcoatRoughnessMapUv:_e&&y(h.clearcoatRoughnessMap.channel),iridescenceMapUv:ge&&y(h.iridescenceMap.channel),iridescenceThicknessMapUv:J&&y(h.iridescenceThicknessMap.channel),sheenColorMapUv:ce&&y(h.sheenColorMap.channel),sheenRoughnessMapUv:Ce&&y(h.sheenRoughnessMap.channel),specularMapUv:ve&&y(h.specularMap.channel),specularColorMapUv:oe&&y(h.specularColorMap.channel),specularIntensityMapUv:Ne&&y(h.specularIntensityMap.channel),transmissionMapUv:E&&y(h.transmissionMap.channel),thicknessMapUv:ee&&y(h.thicknessMap.channel),alphaMapUv:fe&&y(h.alphaMap.channel),vertexTangents:!!q.attributes.tangent&&(he||ct),vertexColors:h.vertexColors,vertexAlphas:h.vertexColors===!0&&!!q.attributes.color&&q.attributes.color.itemSize===4,pointsUvs:W.isPoints===!0&&!!q.attributes.uv&&(He||fe),fog:!!K,useFog:h.fog===!0,fogExp2:!!K&&K.isFogExp2,flatShading:h.flatShading===!0&&h.wireframe===!1,sizeAttenuation:h.sizeAttenuation===!0,logarithmicDepthBuffer:v,reversedDepthBuffer:de,skinning:W.isSkinnedMesh===!0,morphTargets:q.morphAttributes.position!==void 0,morphNormals:q.morphAttributes.normal!==void 0,morphColors:q.morphAttributes.color!==void 0,morphTargetsCount:Oe,morphTextureStride:ze,numDirLights:u.directional.length,numPointLights:u.point.length,numSpotLights:u.spot.length,numSpotLightMaps:u.spotLightMap.length,numRectAreaLights:u.rectArea.length,numHemiLights:u.hemi.length,numDirLightShadows:u.directionalShadowMap.length,numPointLightShadows:u.pointShadowMap.length,numSpotLightShadows:u.spotShadowMap.length,numSpotLightShadowsWithMaps:u.numSpotLightShadowsWithMaps,numLightProbes:u.numLightProbes,numClippingPlanes:p.numPlanes,numClipIntersection:p.numIntersection,dithering:h.dithering,shadowMapEnabled:e.shadowMap.enabled&&A.length>0,shadowMapType:e.shadowMap.type,toneMapping:ye,decodeVideoTexture:He&&h.map.isVideoTexture===!0&&ft.getTransfer(h.map.colorSpace)===Qe,decodeVideoTextureEmissive:me&&h.emissiveMap.isVideoTexture===!0&&ft.getTransfer(h.emissiveMap.colorSpace)===Qe,premultipliedAlpha:h.premultipliedAlpha,doubleSided:h.side===Dt,flipSided:h.side===Rt,useDepthPacking:h.depthPacking>=0,depthPacking:h.depthPacking||0,index0AttributeName:h.index0AttributeName,extensionClipCullDistance:pe&&h.extensions.clipCullDistance===!0&&i.has("WEBGL_clip_cull_distance"),extensionMultiDraw:(pe&&h.extensions.multiDraw===!0||Me)&&i.has("WEBGL_multi_draw"),rendererExtensionParallelShaderCompile:i.has("KHR_parallel_shader_compile"),customProgramCacheKey:h.customProgramCacheKey()};return Ze.vertexUv1s=M.has(1),Ze.vertexUv2s=M.has(2),Ze.vertexUv3s=M.has(3),M.clear(),Ze}function a(h){const u=[];if(h.shaderID?u.push(h.shaderID):(u.push(h.customVertexShaderID),u.push(h.customFragmentShaderID)),h.defines!==void 0)for(const A in h.defines)u.push(A),u.push(h.defines[A]);return h.isRawShaderMaterial===!1&&(U(u,h),R(u,h),u.push(e.outputColorSpace)),u.push(h.customProgramCacheKey),u.join()}function U(h,u){h.push(u.precision),h.push(u.outputColorSpace),h.push(u.envMapMode),h.push(u.envMapCubeUVHeight),h.push(u.mapUv),h.push(u.alphaMapUv),h.push(u.lightMapUv),h.push(u.aoMapUv),h.push(u.bumpMapUv),h.push(u.normalMapUv),h.push(u.displacementMapUv),h.push(u.emissiveMapUv),h.push(u.metalnessMapUv),h.push(u.roughnessMapUv),h.push(u.anisotropyMapUv),h.push(u.clearcoatMapUv),h.push(u.clearcoatNormalMapUv),h.push(u.clearcoatRoughnessMapUv),h.push(u.iridescenceMapUv),h.push(u.iridescenceThicknessMapUv),h.push(u.sheenColorMapUv),h.push(u.sheenRoughnessMapUv),h.push(u.specularMapUv),h.push(u.specularColorMapUv),h.push(u.specularIntensityMapUv),h.push(u.transmissionMapUv),h.push(u.thicknessMapUv),h.push(u.combine),h.push(u.fogExp2),h.push(u.sizeAttenuation),h.push(u.morphTargetsCount),h.push(u.morphAttributeCount),h.push(u.numDirLights),h.push(u.numPointLights),h.push(u.numSpotLights),h.push(u.numSpotLightMaps),h.push(u.numHemiLights),h.push(u.numRectAreaLights),h.push(u.numDirLightShadows),h.push(u.numPointLightShadows),h.push(u.numSpotLightShadows),h.push(u.numSpotLightShadowsWithMaps),h.push(u.numLightProbes),h.push(u.shadowMapType),h.push(u.toneMapping),h.push(u.numClippingPlanes),h.push(u.numClipIntersection),h.push(u.depthPacking)}function R(h,u){f.disableAll(),u.supportsVertexTextures&&f.enable(0),u.instancing&&f.enable(1),u.instancingColor&&f.enable(2),u.instancingMorph&&f.enable(3),u.matcap&&f.enable(4),u.envMap&&f.enable(5),u.normalMapObjectSpace&&f.enable(6),u.normalMapTangentSpace&&f.enable(7),u.clearcoat&&f.enable(8),u.iridescence&&f.enable(9),u.alphaTest&&f.enable(10),u.vertexColors&&f.enable(11),u.vertexAlphas&&f.enable(12),u.vertexUv1s&&f.enable(13),u.vertexUv2s&&f.enable(14),u.vertexUv3s&&f.enable(15),u.vertexTangents&&f.enable(16),u.anisotropy&&f.enable(17),u.alphaHash&&f.enable(18),u.batching&&f.enable(19),u.dispersion&&f.enable(20),u.batchingColor&&f.enable(21),u.gradientMap&&f.enable(22),h.push(f.mask),f.disableAll(),u.fog&&f.enable(0),u.useFog&&f.enable(1),u.flatShading&&f.enable(2),u.logarithmicDepthBuffer&&f.enable(3),u.reversedDepthBuffer&&f.enable(4),u.skinning&&f.enable(5),u.morphTargets&&f.enable(6),u.morphNormals&&f.enable(7),u.morphColors&&f.enable(8),u.premultipliedAlpha&&f.enable(9),u.shadowMapEnabled&&f.enable(10),u.doubleSided&&f.enable(11),u.flipSided&&f.enable(12),u.useDepthPacking&&f.enable(13),u.dithering&&f.enable(14),u.transmission&&f.enable(15),u.sheen&&f.enable(16),u.opaque&&f.enable(17),u.pointsUvs&&f.enable(18),u.decodeVideoTexture&&f.enable(19),u.decodeVideoTextureEmissive&&f.enable(20),u.alphaToCoverage&&f.enable(21),h.push(f.mask)}function g(h){const u=B[h.type];let A;if(u){const F=It[u];A=Zo.clone(F.uniforms)}else A=h.uniforms;return A}function O(h,u){let A;for(let F=0,W=b.length;F<W;F++){const K=b[F];if(K.cacheKey===u){A=K,++A.usedTimes;break}}return A===void 0&&(A=new zd(e,u,h,r),b.push(A)),A}function P(h){if(--h.usedTimes===0){const u=b.indexOf(h);b[u]=b[b.length-1],b.pop(),h.destroy()}}function D(h){x.remove(h)}function G(){x.dispose()}return{getParameters:d,getProgramCacheKey:a,getUniforms:g,acquireProgram:O,releaseProgram:P,releaseShaderCache:D,programs:b,dispose:G}}function $d(){let e=new WeakMap;function n(p){return e.has(p)}function t(p){let f=e.get(p);return f===void 0&&(f={},e.set(p,f)),f}function i(p){e.delete(p)}function o(p,f,x){e.get(p)[f]=x}function r(){e=new WeakMap}return{has:n,get:t,remove:i,update:o,dispose:r}}function Zd(e,n){return e.groupOrder!==n.groupOrder?e.groupOrder-n.groupOrder:e.renderOrder!==n.renderOrder?e.renderOrder-n.renderOrder:e.material.id!==n.material.id?e.material.id-n.material.id:e.z!==n.z?e.z-n.z:e.id-n.id}function ra(e,n){return e.groupOrder!==n.groupOrder?e.groupOrder-n.groupOrder:e.renderOrder!==n.renderOrder?e.renderOrder-n.renderOrder:e.z!==n.z?n.z-e.z:e.id-n.id}function aa(){const e=[];let n=0;const t=[],i=[],o=[];function r(){n=0,t.length=0,i.length=0,o.length=0}function p(v,S,T,B,y,d){let a=e[n];return a===void 0?(a={id:v.id,object:v,geometry:S,material:T,groupOrder:B,renderOrder:v.renderOrder,z:y,group:d},e[n]=a):(a.id=v.id,a.object=v,a.geometry=S,a.material=T,a.groupOrder=B,a.renderOrder=v.renderOrder,a.z=y,a.group=d),n++,a}function f(v,S,T,B,y,d){const a=p(v,S,T,B,y,d);T.transmission>0?i.push(a):T.transparent===!0?o.push(a):t.push(a)}function x(v,S,T,B,y,d){const a=p(v,S,T,B,y,d);T.transmission>0?i.unshift(a):T.transparent===!0?o.unshift(a):t.unshift(a)}function M(v,S){t.length>1&&t.sort(v||Zd),i.length>1&&i.sort(S||ra),o.length>1&&o.sort(S||ra)}function b(){for(let v=n,S=e.length;v<S;v++){const T=e[v];if(T.id===null)break;T.id=null,T.object=null,T.geometry=null,T.material=null,T.group=null}}return{opaque:t,transmissive:i,transparent:o,init:r,push:f,unshift:x,finish:b,sort:M}}function jd(){let e=new WeakMap;function n(i,o){const r=e.get(i);let p;return r===void 0?(p=new aa,e.set(i,[p])):o>=r.length?(p=new aa,r.push(p)):p=r[o],p}function t(){e=new WeakMap}return{get:n,dispose:t}}function Qd(){const e={};return{get:function(n){if(e[n.id]!==void 0)return e[n.id];let t;switch(n.type){case"DirectionalLight":t={direction:new Le,color:new Ye};break;case"SpotLight":t={position:new Le,direction:new Le,color:new Ye,distance:0,coneCos:0,penumbraCos:0,decay:0};break;case"PointLight":t={position:new Le,color:new Ye,distance:0,decay:0};break;case"HemisphereLight":t={direction:new Le,skyColor:new Ye,groundColor:new Ye};break;case"RectAreaLight":t={color:new Ye,position:new Le,halfWidth:new Le,halfHeight:new Le};break}return e[n.id]=t,t}}}function Jd(){const e={};return{get:function(n){if(e[n.id]!==void 0)return e[n.id];let t;switch(n.type){case"DirectionalLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new gt};break;case"SpotLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new gt};break;case"PointLight":t={shadowIntensity:1,shadowBias:0,shadowNormalBias:0,shadowRadius:1,shadowMapSize:new gt,shadowCameraNear:1,shadowCameraFar:1e3};break}return e[n.id]=t,t}}}let eu=0;function tu(e,n){return(n.castShadow?2:0)-(e.castShadow?2:0)+(n.map?1:0)-(e.map?1:0)}function nu(e){const n=new Qd,t=Jd(),i={version:0,hash:{directionalLength:-1,pointLength:-1,spotLength:-1,rectAreaLength:-1,hemiLength:-1,numDirectionalShadows:-1,numPointShadows:-1,numSpotShadows:-1,numSpotMaps:-1,numLightProbes:-1},ambient:[0,0,0],probe:[],directional:[],directionalShadow:[],directionalShadowMap:[],directionalShadowMatrix:[],spot:[],spotLightMap:[],spotShadow:[],spotShadowMap:[],spotLightMatrix:[],rectArea:[],rectAreaLTC1:null,rectAreaLTC2:null,point:[],pointShadow:[],pointShadowMap:[],pointShadowMatrix:[],hemi:[],numSpotLightShadowsWithMaps:0,numLightProbes:0};for(let M=0;M<9;M++)i.probe.push(new Le);const o=new Le,r=new vn,p=new vn;function f(M){let b=0,v=0,S=0;for(let h=0;h<9;h++)i.probe[h].set(0,0,0);let T=0,B=0,y=0,d=0,a=0,U=0,R=0,g=0,O=0,P=0,D=0;M.sort(tu);for(let h=0,u=M.length;h<u;h++){const A=M[h],F=A.color,W=A.intensity,K=A.distance,q=A.shadow&&A.shadow.map?A.shadow.map.texture:null;if(A.isAmbientLight)b+=F.r*W,v+=F.g*W,S+=F.b*W;else if(A.isLightProbe){for(let Y=0;Y<9;Y++)i.probe[Y].addScaledVector(A.sh.coefficients[Y],W);D++}else if(A.isDirectionalLight){const Y=n.get(A);if(Y.color.copy(A.color).multiplyScalar(A.intensity),A.castShadow){const re=A.shadow,k=t.get(A);k.shadowIntensity=re.intensity,k.shadowBias=re.bias,k.shadowNormalBias=re.normalBias,k.shadowRadius=re.radius,k.shadowMapSize=re.mapSize,i.directionalShadow[T]=k,i.directionalShadowMap[T]=q,i.directionalShadowMatrix[T]=A.shadow.matrix,U++}i.directional[T]=Y,T++}else if(A.isSpotLight){const Y=n.get(A);Y.position.setFromMatrixPosition(A.matrixWorld),Y.color.copy(F).multiplyScalar(W),Y.distance=K,Y.coneCos=Math.cos(A.angle),Y.penumbraCos=Math.cos(A.angle*(1-A.penumbra)),Y.decay=A.decay,i.spot[y]=Y;const re=A.shadow;if(A.map&&(i.spotLightMap[O]=A.map,O++,re.updateMatrices(A),A.castShadow&&P++),i.spotLightMatrix[y]=re.matrix,A.castShadow){const k=t.get(A);k.shadowIntensity=re.intensity,k.shadowBias=re.bias,k.shadowNormalBias=re.normalBias,k.shadowRadius=re.radius,k.shadowMapSize=re.mapSize,i.spotShadow[y]=k,i.spotShadowMap[y]=q,g++}y++}else if(A.isRectAreaLight){const Y=n.get(A);Y.color.copy(F).multiplyScalar(W),Y.halfWidth.set(A.width*.5,0,0),Y.halfHeight.set(0,A.height*.5,0),i.rectArea[d]=Y,d++}else if(A.isPointLight){const Y=n.get(A);if(Y.color.copy(A.color).multiplyScalar(A.intensity),Y.distance=A.distance,Y.decay=A.decay,A.castShadow){const re=A.shadow,k=t.get(A);k.shadowIntensity=re.intensity,k.shadowBias=re.bias,k.shadowNormalBias=re.normalBias,k.shadowRadius=re.radius,k.shadowMapSize=re.mapSize,k.shadowCameraNear=re.camera.near,k.shadowCameraFar=re.camera.far,i.pointShadow[B]=k,i.pointShadowMap[B]=q,i.pointShadowMatrix[B]=A.shadow.matrix,R++}i.point[B]=Y,B++}else if(A.isHemisphereLight){const Y=n.get(A);Y.skyColor.copy(A.color).multiplyScalar(W),Y.groundColor.copy(A.groundColor).multiplyScalar(W),i.hemi[a]=Y,a++}}d>0&&(e.has("OES_texture_float_linear")===!0?(i.rectAreaLTC1=ae.LTC_FLOAT_1,i.rectAreaLTC2=ae.LTC_FLOAT_2):(i.rectAreaLTC1=ae.LTC_HALF_1,i.rectAreaLTC2=ae.LTC_HALF_2)),i.ambient[0]=b,i.ambient[1]=v,i.ambient[2]=S;const G=i.hash;(G.directionalLength!==T||G.pointLength!==B||G.spotLength!==y||G.rectAreaLength!==d||G.hemiLength!==a||G.numDirectionalShadows!==U||G.numPointShadows!==R||G.numSpotShadows!==g||G.numSpotMaps!==O||G.numLightProbes!==D)&&(i.directional.length=T,i.spot.length=y,i.rectArea.length=d,i.point.length=B,i.hemi.length=a,i.directionalShadow.length=U,i.directionalShadowMap.length=U,i.pointShadow.length=R,i.pointShadowMap.length=R,i.spotShadow.length=g,i.spotShadowMap.length=g,i.directionalShadowMatrix.length=U,i.pointShadowMatrix.length=R,i.spotLightMatrix.length=g+O-P,i.spotLightMap.length=O,i.numSpotLightShadowsWithMaps=P,i.numLightProbes=D,G.directionalLength=T,G.pointLength=B,G.spotLength=y,G.rectAreaLength=d,G.hemiLength=a,G.numDirectionalShadows=U,G.numPointShadows=R,G.numSpotShadows=g,G.numSpotMaps=O,G.numLightProbes=D,i.version=eu++)}function x(M,b){let v=0,S=0,T=0,B=0,y=0;const d=b.matrixWorldInverse;for(let a=0,U=M.length;a<U;a++){const R=M[a];if(R.isDirectionalLight){const g=i.directional[v];g.direction.setFromMatrixPosition(R.matrixWorld),o.setFromMatrixPosition(R.target.matrixWorld),g.direction.sub(o),g.direction.transformDirection(d),v++}else if(R.isSpotLight){const g=i.spot[T];g.position.setFromMatrixPosition(R.matrixWorld),g.position.applyMatrix4(d),g.direction.setFromMatrixPosition(R.matrixWorld),o.setFromMatrixPosition(R.target.matrixWorld),g.direction.sub(o),g.direction.transformDirection(d),T++}else if(R.isRectAreaLight){const g=i.rectArea[B];g.position.setFromMatrixPosition(R.matrixWorld),g.position.applyMatrix4(d),p.identity(),r.copy(R.matrixWorld),r.premultiply(d),p.extractRotation(r),g.halfWidth.set(R.width*.5,0,0),g.halfHeight.set(0,R.height*.5,0),g.halfWidth.applyMatrix4(p),g.halfHeight.applyMatrix4(p),B++}else if(R.isPointLight){const g=i.point[S];g.position.setFromMatrixPosition(R.matrixWorld),g.position.applyMatrix4(d),S++}else if(R.isHemisphereLight){const g=i.hemi[y];g.direction.setFromMatrixPosition(R.matrixWorld),g.direction.transformDirection(d),y++}}}return{setup:f,setupView:x,state:i}}function oa(e){const n=new nu(e),t=[],i=[];function o(b){M.camera=b,t.length=0,i.length=0}function r(b){t.push(b)}function p(b){i.push(b)}function f(){n.setup(t)}function x(b){n.setupView(t,b)}const M={lightsArray:t,shadowsArray:i,camera:null,lights:n,transmissionRenderTarget:{}};return{init:o,state:M,setupLights:f,setupLightsView:x,pushLight:r,pushShadow:p}}function iu(e){let n=new WeakMap;function t(o,r=0){const p=n.get(o);let f;return p===void 0?(f=new oa(e),n.set(o,[f])):r>=p.length?(f=new oa(e),p.push(f)):f=p[r],f}function i(){n=new WeakMap}return{get:t,dispose:i}}const ru=`void main() {
	gl_Position = vec4( position, 1.0 );
}`,au=`uniform sampler2D shadow_pass;
uniform vec2 resolution;
uniform float radius;
#include <packing>
void main() {
	const float samples = float( VSM_SAMPLES );
	float mean = 0.0;
	float squared_mean = 0.0;
	float uvStride = samples <= 1.0 ? 0.0 : 2.0 / ( samples - 1.0 );
	float uvStart = samples <= 1.0 ? 0.0 : - 1.0;
	for ( float i = 0.0; i < samples; i ++ ) {
		float uvOffset = uvStart + i * uvStride;
		#ifdef HORIZONTAL_PASS
			vec2 distribution = unpackRGBATo2Half( texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( uvOffset, 0.0 ) * radius ) / resolution ) );
			mean += distribution.x;
			squared_mean += distribution.y * distribution.y + distribution.x * distribution.x;
		#else
			float depth = unpackRGBAToDepth( texture2D( shadow_pass, ( gl_FragCoord.xy + vec2( 0.0, uvOffset ) * radius ) / resolution ) );
			mean += depth;
			squared_mean += depth * depth;
		#endif
	}
	mean = mean / samples;
	squared_mean = squared_mean / samples;
	float std_dev = sqrt( squared_mean - mean * mean );
	gl_FragColor = pack2HalfToRGBA( vec2( mean, std_dev ) );
}`;function ou(e,n,t){let i=new ca;const o=new gt,r=new gt,p=new Tt,f=new No({depthPacking:Oo}),x=new Fo,M={},b=t.maxTextureSize,v={[Un]:Rt,[Rt]:Un,[Dt]:Dt},S=new cn({defines:{VSM_SAMPLES:8},uniforms:{shadow_pass:{value:null},resolution:{value:new gt},radius:{value:4}},vertexShader:ru,fragmentShader:au}),T=S.clone();T.defines.HORIZONTAL_PASS=1;const B=new Bi;B.setAttribute("position",new Yn(new Float32Array([-1,-1,.5,3,-1,.5,-1,3,.5]),3));const y=new We(B,S),d=this;this.enabled=!1,this.autoUpdate=!0,this.needsUpdate=!1,this.type=da;let a=this.type;this.render=function(P,D,G){if(d.enabled===!1||d.autoUpdate===!1&&d.needsUpdate===!1||P.length===0)return;const h=e.getRenderTarget(),u=e.getActiveCubeFace(),A=e.getActiveMipmapLevel(),F=e.state;F.setBlending(on),F.buffers.depth.getReversed()===!0?F.buffers.color.setClear(0,0,0,0):F.buffers.color.setClear(1,1,1,1),F.buffers.depth.setTest(!0),F.setScissorTest(!1);const W=a!==Bt&&this.type===Bt,K=a===Bt&&this.type!==Bt;for(let q=0,Y=P.length;q<Y;q++){const re=P[q],k=re.shadow;if(k===void 0){console.warn("THREE.WebGLShadowMap:",re,"has no shadow.");continue}if(k.autoUpdate===!1&&k.needsUpdate===!1)continue;o.copy(k.mapSize);const Ee=k.getFrameExtents();if(o.multiply(Ee),r.copy(k.mapSize),(o.x>b||o.y>b)&&(o.x>b&&(r.x=Math.floor(b/Ee.x),o.x=r.x*Ee.x,k.mapSize.x=r.x),o.y>b&&(r.y=Math.floor(b/Ee.y),o.y=r.y*Ee.y,k.mapSize.y=r.y)),k.map===null||W===!0||K===!0){const Oe=this.type!==Bt?{minFilter:yn,magFilter:yn}:{};k.map!==null&&k.map.dispose(),k.map=new En(o.x,o.y,Oe),k.map.texture.name=re.name+".shadowMap",k.camera.updateProjectionMatrix()}e.setRenderTarget(k.map),e.clear();const Ae=k.getViewportCount();for(let Oe=0;Oe<Ae;Oe++){const ze=k.getViewport(Oe);p.set(r.x*ze.x,r.y*ze.y,r.x*ze.z,r.y*ze.w),F.viewport(p),k.updateMatrices(re,Oe),i=k.getFrustum(),g(D,G,k.camera,re,this.type)}k.isPointLightShadow!==!0&&this.type===Bt&&U(k,G),k.needsUpdate=!1}a=this.type,d.needsUpdate=!1,e.setRenderTarget(h,u,A)};function U(P,D){const G=n.update(y);S.defines.VSM_SAMPLES!==P.blurSamples&&(S.defines.VSM_SAMPLES=P.blurSamples,T.defines.VSM_SAMPLES=P.blurSamples,S.needsUpdate=!0,T.needsUpdate=!0),P.mapPass===null&&(P.mapPass=new En(o.x,o.y)),S.uniforms.shadow_pass.value=P.map.texture,S.uniforms.resolution.value=P.mapSize,S.uniforms.radius.value=P.radius,e.setRenderTarget(P.mapPass),e.clear(),e.renderBufferDirect(D,null,G,S,y,null),T.uniforms.shadow_pass.value=P.mapPass.texture,T.uniforms.resolution.value=P.mapSize,T.uniforms.radius.value=P.radius,e.setRenderTarget(P.map),e.clear(),e.renderBufferDirect(D,null,G,T,y,null)}function R(P,D,G,h){let u=null;const A=G.isPointLight===!0?P.customDistanceMaterial:P.customDepthMaterial;if(A!==void 0)u=A;else if(u=G.isPointLight===!0?x:f,e.localClippingEnabled&&D.clipShadows===!0&&Array.isArray(D.clippingPlanes)&&D.clippingPlanes.length!==0||D.displacementMap&&D.displacementScale!==0||D.alphaMap&&D.alphaTest>0||D.map&&D.alphaTest>0||D.alphaToCoverage===!0){const F=u.uuid,W=D.uuid;let K=M[F];K===void 0&&(K={},M[F]=K);let q=K[W];q===void 0&&(q=u.clone(),K[W]=q,D.addEventListener("dispose",O)),u=q}if(u.visible=D.visible,u.wireframe=D.wireframe,h===Bt?u.side=D.shadowSide!==null?D.shadowSide:D.side:u.side=D.shadowSide!==null?D.shadowSide:v[D.side],u.alphaMap=D.alphaMap,u.alphaTest=D.alphaToCoverage===!0?.5:D.alphaTest,u.map=D.map,u.clipShadows=D.clipShadows,u.clippingPlanes=D.clippingPlanes,u.clipIntersection=D.clipIntersection,u.displacementMap=D.displacementMap,u.displacementScale=D.displacementScale,u.displacementBias=D.displacementBias,u.wireframeLinewidth=D.wireframeLinewidth,u.linewidth=D.linewidth,G.isPointLight===!0&&u.isMeshDistanceMaterial===!0){const F=e.properties.get(u);F.light=G}return u}function g(P,D,G,h,u){if(P.visible===!1)return;if(P.layers.test(D.layers)&&(P.isMesh||P.isLine||P.isPoints)&&(P.castShadow||P.receiveShadow&&u===Bt)&&(!P.frustumCulled||i.intersectsObject(P))){P.modelViewMatrix.multiplyMatrices(G.matrixWorldInverse,P.matrixWorld);const W=n.update(P),K=P.material;if(Array.isArray(K)){const q=W.groups;for(let Y=0,re=q.length;Y<re;Y++){const k=q[Y],Ee=K[k.materialIndex];if(Ee&&Ee.visible){const Ae=R(P,Ee,h,u);P.onBeforeShadow(e,P,D,G,W,Ae,k),e.renderBufferDirect(G,null,W,Ae,P,k),P.onAfterShadow(e,P,D,G,W,Ae,k)}}}else if(K.visible){const q=R(P,K,h,u);P.onBeforeShadow(e,P,D,G,W,q,null),e.renderBufferDirect(G,null,W,q,P,null),P.onAfterShadow(e,P,D,G,W,q,null)}}const F=P.children;for(let W=0,K=F.length;W<K;W++)g(F[W],D,G,h,u)}function O(P){P.target.removeEventListener("dispose",O);for(const G in M){const h=M[G],u=P.target.uuid;u in h&&(h[u].dispose(),delete h[u])}}}const su={[wi]:bi,[Ci]:xi,[Ri]:Ti,[Jn]:Ai,[bi]:wi,[xi]:Ci,[Ti]:Ri,[Ai]:Jn};function cu(e,n){function t(){let E=!1;const ee=new Tt;let ne=null;const fe=new Tt(0,0,0,0);return{setMask:function(j){ne!==j&&!E&&(e.colorMask(j,j,j,j),ne=j)},setLocked:function(j){E=j},setClear:function(j,X,pe,ye,Ze){Ze===!0&&(j*=ye,X*=ye,pe*=ye),ee.set(j,X,pe,ye),fe.equals(ee)===!1&&(e.clearColor(j,X,pe,ye),fe.copy(ee))},reset:function(){E=!1,ne=null,fe.set(-1,0,0,0)}}}function i(){let E=!1,ee=!1,ne=null,fe=null,j=null;return{setReversed:function(X){if(ee!==X){const pe=n.get("EXT_clip_control");X?pe.clipControlEXT(pe.LOWER_LEFT_EXT,pe.ZERO_TO_ONE_EXT):pe.clipControlEXT(pe.LOWER_LEFT_EXT,pe.NEGATIVE_ONE_TO_ONE_EXT),ee=X;const ye=j;j=null,this.setClear(ye)}},getReversed:function(){return ee},setTest:function(X){X?Z(e.DEPTH_TEST):de(e.DEPTH_TEST)},setMask:function(X){ne!==X&&!E&&(e.depthMask(X),ne=X)},setFunc:function(X){if(ee&&(X=su[X]),fe!==X){switch(X){case wi:e.depthFunc(e.NEVER);break;case bi:e.depthFunc(e.ALWAYS);break;case Ci:e.depthFunc(e.LESS);break;case Jn:e.depthFunc(e.LEQUAL);break;case Ri:e.depthFunc(e.EQUAL);break;case Ai:e.depthFunc(e.GEQUAL);break;case xi:e.depthFunc(e.GREATER);break;case Ti:e.depthFunc(e.NOTEQUAL);break;default:e.depthFunc(e.LEQUAL)}fe=X}},setLocked:function(X){E=X},setClear:function(X){j!==X&&(ee&&(X=1-X),e.clearDepth(X),j=X)},reset:function(){E=!1,ne=null,fe=null,j=null,ee=!1}}}function o(){let E=!1,ee=null,ne=null,fe=null,j=null,X=null,pe=null,ye=null,Ze=null;return{setTest:function(Xe){E||(Xe?Z(e.STENCIL_TEST):de(e.STENCIL_TEST))},setMask:function(Xe){ee!==Xe&&!E&&(e.stencilMask(Xe),ee=Xe)},setFunc:function(Xe,Ft,Ut){(ne!==Xe||fe!==Ft||j!==Ut)&&(e.stencilFunc(Xe,Ft,Ut),ne=Xe,fe=Ft,j=Ut)},setOp:function(Xe,Ft,Ut){(X!==Xe||pe!==Ft||ye!==Ut)&&(e.stencilOp(Xe,Ft,Ut),X=Xe,pe=Ft,ye=Ut)},setLocked:function(Xe){E=Xe},setClear:function(Xe){Ze!==Xe&&(e.clearStencil(Xe),Ze=Xe)},reset:function(){E=!1,ee=null,ne=null,fe=null,j=null,X=null,pe=null,ye=null,Ze=null}}}const r=new t,p=new i,f=new o,x=new WeakMap,M=new WeakMap;let b={},v={},S=new WeakMap,T=[],B=null,y=!1,d=null,a=null,U=null,R=null,g=null,O=null,P=null,D=new Ye(0,0,0),G=0,h=!1,u=null,A=null,F=null,W=null,K=null;const q=e.getParameter(e.MAX_COMBINED_TEXTURE_IMAGE_UNITS);let Y=!1,re=0;const k=e.getParameter(e.VERSION);k.indexOf("WebGL")!==-1?(re=parseFloat(/^WebGL (\d)/.exec(k)[1]),Y=re>=1):k.indexOf("OpenGL ES")!==-1&&(re=parseFloat(/^OpenGL ES (\d)/.exec(k)[1]),Y=re>=2);let Ee=null,Ae={};const Oe=e.getParameter(e.SCISSOR_BOX),ze=e.getParameter(e.VIEWPORT),st=new Tt().fromArray(Oe),rt=new Tt().fromArray(ze);function qe(E,ee,ne,fe){const j=new Uint8Array(4),X=e.createTexture();e.bindTexture(E,X),e.texParameteri(E,e.TEXTURE_MIN_FILTER,e.NEAREST),e.texParameteri(E,e.TEXTURE_MAG_FILTER,e.NEAREST);for(let pe=0;pe<ne;pe++)E===e.TEXTURE_3D||E===e.TEXTURE_2D_ARRAY?e.texImage3D(ee,0,e.RGBA,1,1,fe,0,e.RGBA,e.UNSIGNED_BYTE,j):e.texImage2D(ee+pe,0,e.RGBA,1,1,0,e.RGBA,e.UNSIGNED_BYTE,j);return X}const z={};z[e.TEXTURE_2D]=qe(e.TEXTURE_2D,e.TEXTURE_2D,1),z[e.TEXTURE_CUBE_MAP]=qe(e.TEXTURE_CUBE_MAP,e.TEXTURE_CUBE_MAP_POSITIVE_X,6),z[e.TEXTURE_2D_ARRAY]=qe(e.TEXTURE_2D_ARRAY,e.TEXTURE_2D_ARRAY,1,1),z[e.TEXTURE_3D]=qe(e.TEXTURE_3D,e.TEXTURE_3D,1,1),r.setClear(0,0,0,1),p.setClear(1),f.setClear(0),Z(e.DEPTH_TEST),p.setFunc(Jn),we(!1),he(wr),Z(e.CULL_FACE),Je(on);function Z(E){b[E]!==!0&&(e.enable(E),b[E]=!0)}function de(E){b[E]!==!1&&(e.disable(E),b[E]=!1)}function De(E,ee){return v[E]!==ee?(e.bindFramebuffer(E,ee),v[E]=ee,E===e.DRAW_FRAMEBUFFER&&(v[e.FRAMEBUFFER]=ee),E===e.FRAMEBUFFER&&(v[e.DRAW_FRAMEBUFFER]=ee),!0):!1}function Me(E,ee){let ne=T,fe=!1;if(E){ne=S.get(ee),ne===void 0&&(ne=[],S.set(ee,ne));const j=E.textures;if(ne.length!==j.length||ne[0]!==e.COLOR_ATTACHMENT0){for(let X=0,pe=j.length;X<pe;X++)ne[X]=e.COLOR_ATTACHMENT0+X;ne.length=j.length,fe=!0}}else ne[0]!==e.BACK&&(ne[0]=e.BACK,fe=!0);fe&&e.drawBuffers(ne)}function He(E){return B!==E?(e.useProgram(E),B=E,!0):!1}const mt={[Rn]:e.FUNC_ADD,[oo]:e.FUNC_SUBTRACT,[ao]:e.FUNC_REVERSE_SUBTRACT};mt[gs]=e.MIN,mt[vs]=e.MAX;const _={[To]:e.ZERO,[Mo]:e.ONE,[So]:e.SRC_COLOR,[Eo]:e.SRC_ALPHA,[vo]:e.SRC_ALPHA_SATURATE,[go]:e.DST_COLOR,[_o]:e.DST_ALPHA,[mo]:e.ONE_MINUS_SRC_COLOR,[ho]:e.ONE_MINUS_SRC_ALPHA,[po]:e.ONE_MINUS_DST_COLOR,[uo]:e.ONE_MINUS_DST_ALPHA,[fo]:e.CONSTANT_COLOR,[lo]:e.ONE_MINUS_CONSTANT_COLOR,[co]:e.CONSTANT_ALPHA,[so]:e.ONE_MINUS_CONSTANT_ALPHA};function Je(E,ee,ne,fe,j,X,pe,ye,Ze,Xe){if(E===on){y===!0&&(de(e.BLEND),y=!1);return}if(y===!1&&(Z(e.BLEND),y=!0),E!==qo){if(E!==d||Xe!==h){if((a!==Rn||g!==Rn)&&(e.blendEquation(e.FUNC_ADD),a=Rn,g=Rn),Xe)switch(E){case qn:e.blendFuncSeparate(e.ONE,e.ONE_MINUS_SRC_ALPHA,e.ONE,e.ONE_MINUS_SRC_ALPHA);break;case Ht:e.blendFunc(e.ONE,e.ONE);break;case Lr:e.blendFuncSeparate(e.ZERO,e.ONE_MINUS_SRC_COLOR,e.ZERO,e.ONE);break;case Pr:e.blendFuncSeparate(e.DST_COLOR,e.ONE_MINUS_SRC_ALPHA,e.ZERO,e.ONE);break;default:console.error("THREE.WebGLState: Invalid blending: ",E);break}else switch(E){case qn:e.blendFuncSeparate(e.SRC_ALPHA,e.ONE_MINUS_SRC_ALPHA,e.ONE,e.ONE_MINUS_SRC_ALPHA);break;case Ht:e.blendFuncSeparate(e.SRC_ALPHA,e.ONE,e.ONE,e.ONE);break;case Lr:console.error("THREE.WebGLState: SubtractiveBlending requires material.premultipliedAlpha = true");break;case Pr:console.error("THREE.WebGLState: MultiplyBlending requires material.premultipliedAlpha = true");break;default:console.error("THREE.WebGLState: Invalid blending: ",E);break}U=null,R=null,O=null,P=null,D.set(0,0,0),G=0,d=E,h=Xe}return}j=j||ee,X=X||ne,pe=pe||fe,(ee!==a||j!==g)&&(e.blendEquationSeparate(mt[ee],mt[j]),a=ee,g=j),(ne!==U||fe!==R||X!==O||pe!==P)&&(e.blendFuncSeparate(_[ne],_[fe],_[X],_[pe]),U=ne,R=fe,O=X,P=pe),(ye.equals(D)===!1||Ze!==G)&&(e.blendColor(ye.r,ye.g,ye.b,Ze),D.copy(ye),G=Ze),d=E,h=!1}function Ue(E,ee){E.side===Dt?de(e.CULL_FACE):Z(e.CULL_FACE);let ne=E.side===Rt;ee&&(ne=!ne),we(ne),E.blending===qn&&E.transparent===!1?Je(on):Je(E.blending,E.blendEquation,E.blendSrc,E.blendDst,E.blendEquationAlpha,E.blendSrcAlpha,E.blendDstAlpha,E.blendColor,E.blendAlpha,E.premultipliedAlpha),p.setFunc(E.depthFunc),p.setTest(E.depthTest),p.setMask(E.depthWrite),r.setMask(E.colorWrite);const fe=E.stencilWrite;f.setTest(fe),fe&&(f.setMask(E.stencilWriteMask),f.setFunc(E.stencilFunc,E.stencilRef,E.stencilFuncMask),f.setOp(E.stencilFail,E.stencilZFail,E.stencilZPass)),me(E.polygonOffset,E.polygonOffsetFactor,E.polygonOffsetUnits),E.alphaToCoverage===!0?Z(e.SAMPLE_ALPHA_TO_COVERAGE):de(e.SAMPLE_ALPHA_TO_COVERAGE)}function we(E){u!==E&&(E?e.frontFace(e.CW):e.frontFace(e.CCW),u=E)}function he(E){E!==Ko?(Z(e.CULL_FACE),E!==A&&(E===wr?e.cullFace(e.BACK):E===Yo?e.cullFace(e.FRONT):e.cullFace(e.FRONT_AND_BACK))):de(e.CULL_FACE),A=E}function et(E){E!==F&&(Y&&e.lineWidth(E),F=E)}function me(E,ee,ne){E?(Z(e.POLYGON_OFFSET_FILL),(W!==ee||K!==ne)&&(e.polygonOffset(ee,ne),W=ee,K=ne)):de(e.POLYGON_OFFSET_FILL)}function Fe(E){E?Z(e.SCISSOR_TEST):de(e.SCISSOR_TEST)}function pt(E){E===void 0&&(E=e.TEXTURE0+q-1),Ee!==E&&(e.activeTexture(E),Ee=E)}function ct(E,ee,ne){ne===void 0&&(Ee===null?ne=e.TEXTURE0+q-1:ne=Ee);let fe=Ae[ne];fe===void 0&&(fe={type:void 0,texture:void 0},Ae[ne]=fe),(fe.type!==E||fe.texture!==ee)&&(Ee!==ne&&(e.activeTexture(ne),Ee=ne),e.bindTexture(E,ee||z[E]),fe.type=E,fe.texture=ee)}function m(){const E=Ae[Ee];E!==void 0&&E.type!==void 0&&(e.bindTexture(E.type,null),E.type=void 0,E.texture=void 0)}function s(){try{e.compressedTexImage2D(...arguments)}catch(E){console.error("THREE.WebGLState:",E)}}function L(){try{e.compressedTexImage3D(...arguments)}catch(E){console.error("THREE.WebGLState:",E)}}function V(){try{e.texSubImage2D(...arguments)}catch(E){console.error("THREE.WebGLState:",E)}}function $(){try{e.texSubImage3D(...arguments)}catch(E){console.error("THREE.WebGLState:",E)}}function H(){try{e.compressedTexSubImage2D(...arguments)}catch(E){console.error("THREE.WebGLState:",E)}}function Se(){try{e.compressedTexSubImage3D(...arguments)}catch(E){console.error("THREE.WebGLState:",E)}}function te(){try{e.texStorage2D(...arguments)}catch(E){console.error("THREE.WebGLState:",E)}}function _e(){try{e.texStorage3D(...arguments)}catch(E){console.error("THREE.WebGLState:",E)}}function ge(){try{e.texImage2D(...arguments)}catch(E){console.error("THREE.WebGLState:",E)}}function J(){try{e.texImage3D(...arguments)}catch(E){console.error("THREE.WebGLState:",E)}}function ce(E){st.equals(E)===!1&&(e.scissor(E.x,E.y,E.z,E.w),st.copy(E))}function Ce(E){rt.equals(E)===!1&&(e.viewport(E.x,E.y,E.z,E.w),rt.copy(E))}function ve(E,ee){let ne=M.get(ee);ne===void 0&&(ne=new WeakMap,M.set(ee,ne));let fe=ne.get(E);fe===void 0&&(fe=e.getUniformBlockIndex(ee,E.name),ne.set(E,fe))}function oe(E,ee){const fe=M.get(ee).get(E);x.get(ee)!==fe&&(e.uniformBlockBinding(ee,fe,E.__bindingPointIndex),x.set(ee,fe))}function Ne(){e.disable(e.BLEND),e.disable(e.CULL_FACE),e.disable(e.DEPTH_TEST),e.disable(e.POLYGON_OFFSET_FILL),e.disable(e.SCISSOR_TEST),e.disable(e.STENCIL_TEST),e.disable(e.SAMPLE_ALPHA_TO_COVERAGE),e.blendEquation(e.FUNC_ADD),e.blendFunc(e.ONE,e.ZERO),e.blendFuncSeparate(e.ONE,e.ZERO,e.ONE,e.ZERO),e.blendColor(0,0,0,0),e.colorMask(!0,!0,!0,!0),e.clearColor(0,0,0,0),e.depthMask(!0),e.depthFunc(e.LESS),p.setReversed(!1),e.clearDepth(1),e.stencilMask(4294967295),e.stencilFunc(e.ALWAYS,0,4294967295),e.stencilOp(e.KEEP,e.KEEP,e.KEEP),e.clearStencil(0),e.cullFace(e.BACK),e.frontFace(e.CCW),e.polygonOffset(0,0),e.activeTexture(e.TEXTURE0),e.bindFramebuffer(e.FRAMEBUFFER,null),e.bindFramebuffer(e.DRAW_FRAMEBUFFER,null),e.bindFramebuffer(e.READ_FRAMEBUFFER,null),e.useProgram(null),e.lineWidth(1),e.scissor(0,0,e.canvas.width,e.canvas.height),e.viewport(0,0,e.canvas.width,e.canvas.height),b={},Ee=null,Ae={},v={},S=new WeakMap,T=[],B=null,y=!1,d=null,a=null,U=null,R=null,g=null,O=null,P=null,D=new Ye(0,0,0),G=0,h=!1,u=null,A=null,F=null,W=null,K=null,st.set(0,0,e.canvas.width,e.canvas.height),rt.set(0,0,e.canvas.width,e.canvas.height),r.reset(),p.reset(),f.reset()}return{buffers:{color:r,depth:p,stencil:f},enable:Z,disable:de,bindFramebuffer:De,drawBuffers:Me,useProgram:He,setBlending:Je,setMaterial:Ue,setFlipSided:we,setCullFace:he,setLineWidth:et,setPolygonOffset:me,setScissorTest:Fe,activeTexture:pt,bindTexture:ct,unbindTexture:m,compressedTexImage2D:s,compressedTexImage3D:L,texImage2D:ge,texImage3D:J,updateUBOMapping:ve,uniformBlockBinding:oe,texStorage2D:te,texStorage3D:_e,texSubImage2D:V,texSubImage3D:$,compressedTexSubImage2D:H,compressedTexSubImage3D:Se,scissor:ce,viewport:Ce,reset:Ne}}function lu(e,n,t,i,o,r,p){const f=n.has("WEBGL_multisampled_render_to_texture")?n.get("WEBGL_multisampled_render_to_texture"):null,x=typeof navigator>"u"?!1:/OculusBrowser/g.test(navigator.userAgent),M=new gt,b=new WeakMap;let v;const S=new WeakMap;let T=!1;try{T=typeof OffscreenCanvas<"u"&&new OffscreenCanvas(1,1).getContext("2d")!==null}catch{}function B(m,s){return T?new OffscreenCanvas(m,s):ps("canvas")}function y(m,s,L){let V=1;const $=ct(m);if(($.width>L||$.height>L)&&(V=L/Math.max($.width,$.height)),V<1)if(typeof HTMLImageElement<"u"&&m instanceof HTMLImageElement||typeof HTMLCanvasElement<"u"&&m instanceof HTMLCanvasElement||typeof ImageBitmap<"u"&&m instanceof ImageBitmap||typeof VideoFrame<"u"&&m instanceof VideoFrame){const H=Math.floor(V*$.width),Se=Math.floor(V*$.height);v===void 0&&(v=B(H,Se));const te=s?B(H,Se):v;return te.width=H,te.height=Se,te.getContext("2d").drawImage(m,0,0,H,Se),console.warn("THREE.WebGLRenderer: Texture has been resized from ("+$.width+"x"+$.height+") to ("+H+"x"+Se+")."),te}else return"data"in m&&console.warn("THREE.WebGLRenderer: Image in DataTexture is too big ("+$.width+"x"+$.height+")."),m;return m}function d(m){return m.generateMipmaps}function a(m){e.generateMipmap(m)}function U(m){return m.isWebGLCubeRenderTarget?e.TEXTURE_CUBE_MAP:m.isWebGL3DRenderTarget?e.TEXTURE_3D:m.isWebGLArrayRenderTarget||m.isCompressedArrayTexture?e.TEXTURE_2D_ARRAY:e.TEXTURE_2D}function R(m,s,L,V,$=!1){if(m!==null){if(e[m]!==void 0)return e[m];console.warn("THREE.WebGLRenderer: Attempt to use non-existing WebGL internal format '"+m+"'")}let H=s;if(s===e.RED&&(L===e.FLOAT&&(H=e.R32F),L===e.HALF_FLOAT&&(H=e.R16F),L===e.UNSIGNED_BYTE&&(H=e.R8)),s===e.RED_INTEGER&&(L===e.UNSIGNED_BYTE&&(H=e.R8UI),L===e.UNSIGNED_SHORT&&(H=e.R16UI),L===e.UNSIGNED_INT&&(H=e.R32UI),L===e.BYTE&&(H=e.R8I),L===e.SHORT&&(H=e.R16I),L===e.INT&&(H=e.R32I)),s===e.RG&&(L===e.FLOAT&&(H=e.RG32F),L===e.HALF_FLOAT&&(H=e.RG16F),L===e.UNSIGNED_BYTE&&(H=e.RG8)),s===e.RG_INTEGER&&(L===e.UNSIGNED_BYTE&&(H=e.RG8UI),L===e.UNSIGNED_SHORT&&(H=e.RG16UI),L===e.UNSIGNED_INT&&(H=e.RG32UI),L===e.BYTE&&(H=e.RG8I),L===e.SHORT&&(H=e.RG16I),L===e.INT&&(H=e.RG32I)),s===e.RGB_INTEGER&&(L===e.UNSIGNED_BYTE&&(H=e.RGB8UI),L===e.UNSIGNED_SHORT&&(H=e.RGB16UI),L===e.UNSIGNED_INT&&(H=e.RGB32UI),L===e.BYTE&&(H=e.RGB8I),L===e.SHORT&&(H=e.RGB16I),L===e.INT&&(H=e.RGB32I)),s===e.RGBA_INTEGER&&(L===e.UNSIGNED_BYTE&&(H=e.RGBA8UI),L===e.UNSIGNED_SHORT&&(H=e.RGBA16UI),L===e.UNSIGNED_INT&&(H=e.RGBA32UI),L===e.BYTE&&(H=e.RGBA8I),L===e.SHORT&&(H=e.RGBA16I),L===e.INT&&(H=e.RGBA32I)),s===e.RGB&&(L===e.UNSIGNED_INT_5_9_9_9_REV&&(H=e.RGB9_E5),L===e.UNSIGNED_INT_10F_11F_11F_REV&&(H=e.R11F_G11F_B10F)),s===e.RGBA){const Se=$?Ma:ft.getTransfer(V);L===e.FLOAT&&(H=e.RGBA32F),L===e.HALF_FLOAT&&(H=e.RGBA16F),L===e.UNSIGNED_BYTE&&(H=Se===Qe?e.SRGB8_ALPHA8:e.RGBA8),L===e.UNSIGNED_SHORT_4_4_4_4&&(H=e.RGBA4),L===e.UNSIGNED_SHORT_5_5_5_1&&(H=e.RGB5_A1)}return(H===e.R16F||H===e.R32F||H===e.RG16F||H===e.RG32F||H===e.RGBA16F||H===e.RGBA32F)&&n.get("EXT_color_buffer_float"),H}function g(m,s){let L;return m?s===null||s===Nn||s===In?L=e.DEPTH24_STENCIL8:s===an?L=e.DEPTH32F_STENCIL8:s===ei&&(L=e.DEPTH24_STENCIL8,console.warn("DepthTexture: 16 bit depth attachment is not supported with stencil. Using 24-bit attachment.")):s===null||s===Nn||s===In?L=e.DEPTH_COMPONENT24:s===an?L=e.DEPTH_COMPONENT32F:s===ei&&(L=e.DEPTH_COMPONENT16),L}function O(m,s){return d(m)===!0||m.isFramebufferTexture&&m.minFilter!==yn&&m.minFilter!==mn?Math.log2(Math.max(s.width,s.height))+1:m.mipmaps!==void 0&&m.mipmaps.length>0?m.mipmaps.length:m.isCompressedTexture&&Array.isArray(m.image)?s.mipmaps.length:1}function P(m){const s=m.target;s.removeEventListener("dispose",P),G(s),s.isVideoTexture&&b.delete(s)}function D(m){const s=m.target;s.removeEventListener("dispose",D),u(s)}function G(m){const s=i.get(m);if(s.__webglInit===void 0)return;const L=m.source,V=S.get(L);if(V){const $=V[s.__cacheKey];$.usedTimes--,$.usedTimes===0&&h(m),Object.keys(V).length===0&&S.delete(L)}i.remove(m)}function h(m){const s=i.get(m);e.deleteTexture(s.__webglTexture);const L=m.source,V=S.get(L);delete V[s.__cacheKey],p.memory.textures--}function u(m){const s=i.get(m);if(m.depthTexture&&(m.depthTexture.dispose(),i.remove(m.depthTexture)),m.isWebGLCubeRenderTarget)for(let V=0;V<6;V++){if(Array.isArray(s.__webglFramebuffer[V]))for(let $=0;$<s.__webglFramebuffer[V].length;$++)e.deleteFramebuffer(s.__webglFramebuffer[V][$]);else e.deleteFramebuffer(s.__webglFramebuffer[V]);s.__webglDepthbuffer&&e.deleteRenderbuffer(s.__webglDepthbuffer[V])}else{if(Array.isArray(s.__webglFramebuffer))for(let V=0;V<s.__webglFramebuffer.length;V++)e.deleteFramebuffer(s.__webglFramebuffer[V]);else e.deleteFramebuffer(s.__webglFramebuffer);if(s.__webglDepthbuffer&&e.deleteRenderbuffer(s.__webglDepthbuffer),s.__webglMultisampledFramebuffer&&e.deleteFramebuffer(s.__webglMultisampledFramebuffer),s.__webglColorRenderbuffer)for(let V=0;V<s.__webglColorRenderbuffer.length;V++)s.__webglColorRenderbuffer[V]&&e.deleteRenderbuffer(s.__webglColorRenderbuffer[V]);s.__webglDepthRenderbuffer&&e.deleteRenderbuffer(s.__webglDepthRenderbuffer)}const L=m.textures;for(let V=0,$=L.length;V<$;V++){const H=i.get(L[V]);H.__webglTexture&&(e.deleteTexture(H.__webglTexture),p.memory.textures--),i.remove(L[V])}i.remove(m)}let A=0;function F(){A=0}function W(){const m=A;return m>=o.maxTextures&&console.warn("THREE.WebGLTextures: Trying to use "+m+" texture units while this GPU supports only "+o.maxTextures),A+=1,m}function K(m){const s=[];return s.push(m.wrapS),s.push(m.wrapT),s.push(m.wrapR||0),s.push(m.magFilter),s.push(m.minFilter),s.push(m.anisotropy),s.push(m.internalFormat),s.push(m.format),s.push(m.type),s.push(m.generateMipmaps),s.push(m.premultiplyAlpha),s.push(m.flipY),s.push(m.unpackAlignment),s.push(m.colorSpace),s.join()}function q(m,s){const L=i.get(m);if(m.isVideoTexture&&Fe(m),m.isRenderTargetTexture===!1&&m.isExternalTexture!==!0&&m.version>0&&L.__version!==m.version){const V=m.image;if(V===null)console.warn("THREE.WebGLRenderer: Texture marked for update but no image data found.");else if(V.complete===!1)console.warn("THREE.WebGLRenderer: Texture marked for update but image is incomplete");else{z(L,m,s);return}}else m.isExternalTexture&&(L.__webglTexture=m.sourceTexture?m.sourceTexture:null);t.bindTexture(e.TEXTURE_2D,L.__webglTexture,e.TEXTURE0+s)}function Y(m,s){const L=i.get(m);if(m.isRenderTargetTexture===!1&&m.version>0&&L.__version!==m.version){z(L,m,s);return}t.bindTexture(e.TEXTURE_2D_ARRAY,L.__webglTexture,e.TEXTURE0+s)}function re(m,s){const L=i.get(m);if(m.isRenderTargetTexture===!1&&m.version>0&&L.__version!==m.version){z(L,m,s);return}t.bindTexture(e.TEXTURE_3D,L.__webglTexture,e.TEXTURE0+s)}function k(m,s){const L=i.get(m);if(m.version>0&&L.__version!==m.version){Z(L,m,s);return}t.bindTexture(e.TEXTURE_CUBE_MAP,L.__webglTexture,e.TEXTURE0+s)}const Ee={[Ro]:e.REPEAT,[Ao]:e.CLAMP_TO_EDGE,[xo]:e.MIRRORED_REPEAT},Ae={[yn]:e.NEAREST,[Co]:e.NEAREST_MIPMAP_NEAREST,[Wn]:e.NEAREST_MIPMAP_LINEAR,[mn]:e.LINEAR,[li]:e.LINEAR_MIPMAP_NEAREST,[wn]:e.LINEAR_MIPMAP_LINEAR},Oe={[Uo]:e.NEVER,[yo]:e.ALWAYS,[Do]:e.LESS,[fa]:e.LEQUAL,[Lo]:e.EQUAL,[Po]:e.GEQUAL,[wo]:e.GREATER,[bo]:e.NOTEQUAL};function ze(m,s){if(s.type===an&&n.has("OES_texture_float_linear")===!1&&(s.magFilter===mn||s.magFilter===li||s.magFilter===Wn||s.magFilter===wn||s.minFilter===mn||s.minFilter===li||s.minFilter===Wn||s.minFilter===wn)&&console.warn("THREE.WebGLRenderer: Unable to use linear filtering with floating point textures. OES_texture_float_linear not supported on this device."),e.texParameteri(m,e.TEXTURE_WRAP_S,Ee[s.wrapS]),e.texParameteri(m,e.TEXTURE_WRAP_T,Ee[s.wrapT]),(m===e.TEXTURE_3D||m===e.TEXTURE_2D_ARRAY)&&e.texParameteri(m,e.TEXTURE_WRAP_R,Ee[s.wrapR]),e.texParameteri(m,e.TEXTURE_MAG_FILTER,Ae[s.magFilter]),e.texParameteri(m,e.TEXTURE_MIN_FILTER,Ae[s.minFilter]),s.compareFunction&&(e.texParameteri(m,e.TEXTURE_COMPARE_MODE,e.COMPARE_REF_TO_TEXTURE),e.texParameteri(m,e.TEXTURE_COMPARE_FUNC,Oe[s.compareFunction])),n.has("EXT_texture_filter_anisotropic")===!0){if(s.magFilter===yn||s.minFilter!==Wn&&s.minFilter!==wn||s.type===an&&n.has("OES_texture_float_linear")===!1)return;if(s.anisotropy>1||i.get(s).__currentAnisotropy){const L=n.get("EXT_texture_filter_anisotropic");e.texParameterf(m,L.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(s.anisotropy,o.getMaxAnisotropy())),i.get(s).__currentAnisotropy=s.anisotropy}}}function st(m,s){let L=!1;m.__webglInit===void 0&&(m.__webglInit=!0,s.addEventListener("dispose",P));const V=s.source;let $=S.get(V);$===void 0&&($={},S.set(V,$));const H=K(s);if(H!==m.__cacheKey){$[H]===void 0&&($[H]={texture:e.createTexture(),usedTimes:0},p.memory.textures++,L=!0),$[H].usedTimes++;const Se=$[m.__cacheKey];Se!==void 0&&($[m.__cacheKey].usedTimes--,Se.usedTimes===0&&h(s)),m.__cacheKey=H,m.__webglTexture=$[H].texture}return L}function rt(m,s,L){return Math.floor(Math.floor(m/L)/s)}function qe(m,s,L,V){const H=m.updateRanges;if(H.length===0)t.texSubImage2D(e.TEXTURE_2D,0,0,0,s.width,s.height,L,V,s.data);else{H.sort((J,ce)=>J.start-ce.start);let Se=0;for(let J=1;J<H.length;J++){const ce=H[Se],Ce=H[J],ve=ce.start+ce.count,oe=rt(Ce.start,s.width,4),Ne=rt(ce.start,s.width,4);Ce.start<=ve+1&&oe===Ne&&rt(Ce.start+Ce.count-1,s.width,4)===oe?ce.count=Math.max(ce.count,Ce.start+Ce.count-ce.start):(++Se,H[Se]=Ce)}H.length=Se+1;const te=e.getParameter(e.UNPACK_ROW_LENGTH),_e=e.getParameter(e.UNPACK_SKIP_PIXELS),ge=e.getParameter(e.UNPACK_SKIP_ROWS);e.pixelStorei(e.UNPACK_ROW_LENGTH,s.width);for(let J=0,ce=H.length;J<ce;J++){const Ce=H[J],ve=Math.floor(Ce.start/4),oe=Math.ceil(Ce.count/4),Ne=ve%s.width,E=Math.floor(ve/s.width),ee=oe,ne=1;e.pixelStorei(e.UNPACK_SKIP_PIXELS,Ne),e.pixelStorei(e.UNPACK_SKIP_ROWS,E),t.texSubImage2D(e.TEXTURE_2D,0,Ne,E,ee,ne,L,V,s.data)}m.clearUpdateRanges(),e.pixelStorei(e.UNPACK_ROW_LENGTH,te),e.pixelStorei(e.UNPACK_SKIP_PIXELS,_e),e.pixelStorei(e.UNPACK_SKIP_ROWS,ge)}}function z(m,s,L){let V=e.TEXTURE_2D;(s.isDataArrayTexture||s.isCompressedArrayTexture)&&(V=e.TEXTURE_2D_ARRAY),s.isData3DTexture&&(V=e.TEXTURE_3D);const $=st(m,s),H=s.source;t.bindTexture(V,m.__webglTexture,e.TEXTURE0+L);const Se=i.get(H);if(H.version!==Se.__version||$===!0){t.activeTexture(e.TEXTURE0+L);const te=ft.getPrimaries(ft.workingColorSpace),_e=s.colorSpace===pn?null:ft.getPrimaries(s.colorSpace),ge=s.colorSpace===pn||te===_e?e.NONE:e.BROWSER_DEFAULT_WEBGL;e.pixelStorei(e.UNPACK_FLIP_Y_WEBGL,s.flipY),e.pixelStorei(e.UNPACK_PREMULTIPLY_ALPHA_WEBGL,s.premultiplyAlpha),e.pixelStorei(e.UNPACK_ALIGNMENT,s.unpackAlignment),e.pixelStorei(e.UNPACK_COLORSPACE_CONVERSION_WEBGL,ge);let J=y(s.image,!1,o.maxTextureSize);J=pt(s,J);const ce=r.convert(s.format,s.colorSpace),Ce=r.convert(s.type);let ve=R(s.internalFormat,ce,Ce,s.colorSpace,s.isVideoTexture);ze(V,s);let oe;const Ne=s.mipmaps,E=s.isVideoTexture!==!0,ee=Se.__version===void 0||$===!0,ne=H.dataReady,fe=O(s,J);if(s.isDepthTexture)ve=g(s.format===Qn,s.type),ee&&(E?t.texStorage2D(e.TEXTURE_2D,1,ve,J.width,J.height):t.texImage2D(e.TEXTURE_2D,0,ve,J.width,J.height,0,ce,Ce,null));else if(s.isDataTexture)if(Ne.length>0){E&&ee&&t.texStorage2D(e.TEXTURE_2D,fe,ve,Ne[0].width,Ne[0].height);for(let j=0,X=Ne.length;j<X;j++)oe=Ne[j],E?ne&&t.texSubImage2D(e.TEXTURE_2D,j,0,0,oe.width,oe.height,ce,Ce,oe.data):t.texImage2D(e.TEXTURE_2D,j,ve,oe.width,oe.height,0,ce,Ce,oe.data);s.generateMipmaps=!1}else E?(ee&&t.texStorage2D(e.TEXTURE_2D,fe,ve,J.width,J.height),ne&&qe(s,J,ce,Ce)):t.texImage2D(e.TEXTURE_2D,0,ve,J.width,J.height,0,ce,Ce,J.data);else if(s.isCompressedTexture)if(s.isCompressedArrayTexture){E&&ee&&t.texStorage3D(e.TEXTURE_2D_ARRAY,fe,ve,Ne[0].width,Ne[0].height,J.depth);for(let j=0,X=Ne.length;j<X;j++)if(oe=Ne[j],s.format!==Gt)if(ce!==null)if(E){if(ne)if(s.layerUpdates.size>0){const pe=yr(oe.width,oe.height,s.format,s.type);for(const ye of s.layerUpdates){const Ze=oe.data.subarray(ye*pe/oe.data.BYTES_PER_ELEMENT,(ye+1)*pe/oe.data.BYTES_PER_ELEMENT);t.compressedTexSubImage3D(e.TEXTURE_2D_ARRAY,j,0,0,ye,oe.width,oe.height,1,ce,Ze)}s.clearLayerUpdates()}else t.compressedTexSubImage3D(e.TEXTURE_2D_ARRAY,j,0,0,0,oe.width,oe.height,J.depth,ce,oe.data)}else t.compressedTexImage3D(e.TEXTURE_2D_ARRAY,j,ve,oe.width,oe.height,J.depth,0,oe.data,0,0);else console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()");else E?ne&&t.texSubImage3D(e.TEXTURE_2D_ARRAY,j,0,0,0,oe.width,oe.height,J.depth,ce,Ce,oe.data):t.texImage3D(e.TEXTURE_2D_ARRAY,j,ve,oe.width,oe.height,J.depth,0,ce,Ce,oe.data)}else{E&&ee&&t.texStorage2D(e.TEXTURE_2D,fe,ve,Ne[0].width,Ne[0].height);for(let j=0,X=Ne.length;j<X;j++)oe=Ne[j],s.format!==Gt?ce!==null?E?ne&&t.compressedTexSubImage2D(e.TEXTURE_2D,j,0,0,oe.width,oe.height,ce,oe.data):t.compressedTexImage2D(e.TEXTURE_2D,j,ve,oe.width,oe.height,0,oe.data):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .uploadTexture()"):E?ne&&t.texSubImage2D(e.TEXTURE_2D,j,0,0,oe.width,oe.height,ce,Ce,oe.data):t.texImage2D(e.TEXTURE_2D,j,ve,oe.width,oe.height,0,ce,Ce,oe.data)}else if(s.isDataArrayTexture)if(E){if(ee&&t.texStorage3D(e.TEXTURE_2D_ARRAY,fe,ve,J.width,J.height,J.depth),ne)if(s.layerUpdates.size>0){const j=yr(J.width,J.height,s.format,s.type);for(const X of s.layerUpdates){const pe=J.data.subarray(X*j/J.data.BYTES_PER_ELEMENT,(X+1)*j/J.data.BYTES_PER_ELEMENT);t.texSubImage3D(e.TEXTURE_2D_ARRAY,0,0,0,X,J.width,J.height,1,ce,Ce,pe)}s.clearLayerUpdates()}else t.texSubImage3D(e.TEXTURE_2D_ARRAY,0,0,0,0,J.width,J.height,J.depth,ce,Ce,J.data)}else t.texImage3D(e.TEXTURE_2D_ARRAY,0,ve,J.width,J.height,J.depth,0,ce,Ce,J.data);else if(s.isData3DTexture)E?(ee&&t.texStorage3D(e.TEXTURE_3D,fe,ve,J.width,J.height,J.depth),ne&&t.texSubImage3D(e.TEXTURE_3D,0,0,0,0,J.width,J.height,J.depth,ce,Ce,J.data)):t.texImage3D(e.TEXTURE_3D,0,ve,J.width,J.height,J.depth,0,ce,Ce,J.data);else if(s.isFramebufferTexture){if(ee)if(E)t.texStorage2D(e.TEXTURE_2D,fe,ve,J.width,J.height);else{let j=J.width,X=J.height;for(let pe=0;pe<fe;pe++)t.texImage2D(e.TEXTURE_2D,pe,ve,j,X,0,ce,Ce,null),j>>=1,X>>=1}}else if(Ne.length>0){if(E&&ee){const j=ct(Ne[0]);t.texStorage2D(e.TEXTURE_2D,fe,ve,j.width,j.height)}for(let j=0,X=Ne.length;j<X;j++)oe=Ne[j],E?ne&&t.texSubImage2D(e.TEXTURE_2D,j,0,0,ce,Ce,oe):t.texImage2D(e.TEXTURE_2D,j,ve,ce,Ce,oe);s.generateMipmaps=!1}else if(E){if(ee){const j=ct(J);t.texStorage2D(e.TEXTURE_2D,fe,ve,j.width,j.height)}ne&&t.texSubImage2D(e.TEXTURE_2D,0,0,0,ce,Ce,J)}else t.texImage2D(e.TEXTURE_2D,0,ve,ce,Ce,J);d(s)&&a(V),Se.__version=H.version,s.onUpdate&&s.onUpdate(s)}m.__version=s.version}function Z(m,s,L){if(s.image.length!==6)return;const V=st(m,s),$=s.source;t.bindTexture(e.TEXTURE_CUBE_MAP,m.__webglTexture,e.TEXTURE0+L);const H=i.get($);if($.version!==H.__version||V===!0){t.activeTexture(e.TEXTURE0+L);const Se=ft.getPrimaries(ft.workingColorSpace),te=s.colorSpace===pn?null:ft.getPrimaries(s.colorSpace),_e=s.colorSpace===pn||Se===te?e.NONE:e.BROWSER_DEFAULT_WEBGL;e.pixelStorei(e.UNPACK_FLIP_Y_WEBGL,s.flipY),e.pixelStorei(e.UNPACK_PREMULTIPLY_ALPHA_WEBGL,s.premultiplyAlpha),e.pixelStorei(e.UNPACK_ALIGNMENT,s.unpackAlignment),e.pixelStorei(e.UNPACK_COLORSPACE_CONVERSION_WEBGL,_e);const ge=s.isCompressedTexture||s.image[0].isCompressedTexture,J=s.image[0]&&s.image[0].isDataTexture,ce=[];for(let X=0;X<6;X++)!ge&&!J?ce[X]=y(s.image[X],!0,o.maxCubemapSize):ce[X]=J?s.image[X].image:s.image[X],ce[X]=pt(s,ce[X]);const Ce=ce[0],ve=r.convert(s.format,s.colorSpace),oe=r.convert(s.type),Ne=R(s.internalFormat,ve,oe,s.colorSpace),E=s.isVideoTexture!==!0,ee=H.__version===void 0||V===!0,ne=$.dataReady;let fe=O(s,Ce);ze(e.TEXTURE_CUBE_MAP,s);let j;if(ge){E&&ee&&t.texStorage2D(e.TEXTURE_CUBE_MAP,fe,Ne,Ce.width,Ce.height);for(let X=0;X<6;X++){j=ce[X].mipmaps;for(let pe=0;pe<j.length;pe++){const ye=j[pe];s.format!==Gt?ve!==null?E?ne&&t.compressedTexSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+X,pe,0,0,ye.width,ye.height,ve,ye.data):t.compressedTexImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+X,pe,Ne,ye.width,ye.height,0,ye.data):console.warn("THREE.WebGLRenderer: Attempt to load unsupported compressed texture format in .setTextureCube()"):E?ne&&t.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+X,pe,0,0,ye.width,ye.height,ve,oe,ye.data):t.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+X,pe,Ne,ye.width,ye.height,0,ve,oe,ye.data)}}}else{if(j=s.mipmaps,E&&ee){j.length>0&&fe++;const X=ct(ce[0]);t.texStorage2D(e.TEXTURE_CUBE_MAP,fe,Ne,X.width,X.height)}for(let X=0;X<6;X++)if(J){E?ne&&t.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+X,0,0,0,ce[X].width,ce[X].height,ve,oe,ce[X].data):t.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+X,0,Ne,ce[X].width,ce[X].height,0,ve,oe,ce[X].data);for(let pe=0;pe<j.length;pe++){const Ze=j[pe].image[X].image;E?ne&&t.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+X,pe+1,0,0,Ze.width,Ze.height,ve,oe,Ze.data):t.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+X,pe+1,Ne,Ze.width,Ze.height,0,ve,oe,Ze.data)}}else{E?ne&&t.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+X,0,0,0,ve,oe,ce[X]):t.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+X,0,Ne,ve,oe,ce[X]);for(let pe=0;pe<j.length;pe++){const ye=j[pe];E?ne&&t.texSubImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+X,pe+1,0,0,ve,oe,ye.image[X]):t.texImage2D(e.TEXTURE_CUBE_MAP_POSITIVE_X+X,pe+1,Ne,ve,oe,ye.image[X])}}}d(s)&&a(e.TEXTURE_CUBE_MAP),H.__version=$.version,s.onUpdate&&s.onUpdate(s)}m.__version=s.version}function de(m,s,L,V,$,H){const Se=r.convert(L.format,L.colorSpace),te=r.convert(L.type),_e=R(L.internalFormat,Se,te,L.colorSpace),ge=i.get(s),J=i.get(L);if(J.__renderTarget=s,!ge.__hasExternalTextures){const ce=Math.max(1,s.width>>H),Ce=Math.max(1,s.height>>H);$===e.TEXTURE_3D||$===e.TEXTURE_2D_ARRAY?t.texImage3D($,H,_e,ce,Ce,s.depth,0,Se,te,null):t.texImage2D($,H,_e,ce,Ce,0,Se,te,null)}t.bindFramebuffer(e.FRAMEBUFFER,m),me(s)?f.framebufferTexture2DMultisampleEXT(e.FRAMEBUFFER,V,$,J.__webglTexture,0,et(s)):($===e.TEXTURE_2D||$>=e.TEXTURE_CUBE_MAP_POSITIVE_X&&$<=e.TEXTURE_CUBE_MAP_NEGATIVE_Z)&&e.framebufferTexture2D(e.FRAMEBUFFER,V,$,J.__webglTexture,H),t.bindFramebuffer(e.FRAMEBUFFER,null)}function De(m,s,L){if(e.bindRenderbuffer(e.RENDERBUFFER,m),s.depthBuffer){const V=s.depthTexture,$=V&&V.isDepthTexture?V.type:null,H=g(s.stencilBuffer,$),Se=s.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT,te=et(s);me(s)?f.renderbufferStorageMultisampleEXT(e.RENDERBUFFER,te,H,s.width,s.height):L?e.renderbufferStorageMultisample(e.RENDERBUFFER,te,H,s.width,s.height):e.renderbufferStorage(e.RENDERBUFFER,H,s.width,s.height),e.framebufferRenderbuffer(e.FRAMEBUFFER,Se,e.RENDERBUFFER,m)}else{const V=s.textures;for(let $=0;$<V.length;$++){const H=V[$],Se=r.convert(H.format,H.colorSpace),te=r.convert(H.type),_e=R(H.internalFormat,Se,te,H.colorSpace),ge=et(s);L&&me(s)===!1?e.renderbufferStorageMultisample(e.RENDERBUFFER,ge,_e,s.width,s.height):me(s)?f.renderbufferStorageMultisampleEXT(e.RENDERBUFFER,ge,_e,s.width,s.height):e.renderbufferStorage(e.RENDERBUFFER,_e,s.width,s.height)}}e.bindRenderbuffer(e.RENDERBUFFER,null)}function Me(m,s){if(s&&s.isWebGLCubeRenderTarget)throw new Error("Depth Texture with cube render targets is not supported");if(t.bindFramebuffer(e.FRAMEBUFFER,m),!(s.depthTexture&&s.depthTexture.isDepthTexture))throw new Error("renderTarget.depthTexture must be an instance of THREE.DepthTexture");const V=i.get(s.depthTexture);V.__renderTarget=s,(!V.__webglTexture||s.depthTexture.image.width!==s.width||s.depthTexture.image.height!==s.height)&&(s.depthTexture.image.width=s.width,s.depthTexture.image.height=s.height,s.depthTexture.needsUpdate=!0),q(s.depthTexture,0);const $=V.__webglTexture,H=et(s);if(s.depthTexture.format===Fi)me(s)?f.framebufferTexture2DMultisampleEXT(e.FRAMEBUFFER,e.DEPTH_ATTACHMENT,e.TEXTURE_2D,$,0,H):e.framebufferTexture2D(e.FRAMEBUFFER,e.DEPTH_ATTACHMENT,e.TEXTURE_2D,$,0);else if(s.depthTexture.format===Qn)me(s)?f.framebufferTexture2DMultisampleEXT(e.FRAMEBUFFER,e.DEPTH_STENCIL_ATTACHMENT,e.TEXTURE_2D,$,0,H):e.framebufferTexture2D(e.FRAMEBUFFER,e.DEPTH_STENCIL_ATTACHMENT,e.TEXTURE_2D,$,0);else throw new Error("Unknown depthTexture format")}function He(m){const s=i.get(m),L=m.isWebGLCubeRenderTarget===!0;if(s.__boundDepthTexture!==m.depthTexture){const V=m.depthTexture;if(s.__depthDisposeCallback&&s.__depthDisposeCallback(),V){const $=()=>{delete s.__boundDepthTexture,delete s.__depthDisposeCallback,V.removeEventListener("dispose",$)};V.addEventListener("dispose",$),s.__depthDisposeCallback=$}s.__boundDepthTexture=V}if(m.depthTexture&&!s.__autoAllocateDepthBuffer){if(L)throw new Error("target.depthTexture not supported in Cube render targets");const V=m.texture.mipmaps;V&&V.length>0?Me(s.__webglFramebuffer[0],m):Me(s.__webglFramebuffer,m)}else if(L){s.__webglDepthbuffer=[];for(let V=0;V<6;V++)if(t.bindFramebuffer(e.FRAMEBUFFER,s.__webglFramebuffer[V]),s.__webglDepthbuffer[V]===void 0)s.__webglDepthbuffer[V]=e.createRenderbuffer(),De(s.__webglDepthbuffer[V],m,!1);else{const $=m.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT,H=s.__webglDepthbuffer[V];e.bindRenderbuffer(e.RENDERBUFFER,H),e.framebufferRenderbuffer(e.FRAMEBUFFER,$,e.RENDERBUFFER,H)}}else{const V=m.texture.mipmaps;if(V&&V.length>0?t.bindFramebuffer(e.FRAMEBUFFER,s.__webglFramebuffer[0]):t.bindFramebuffer(e.FRAMEBUFFER,s.__webglFramebuffer),s.__webglDepthbuffer===void 0)s.__webglDepthbuffer=e.createRenderbuffer(),De(s.__webglDepthbuffer,m,!1);else{const $=m.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT,H=s.__webglDepthbuffer;e.bindRenderbuffer(e.RENDERBUFFER,H),e.framebufferRenderbuffer(e.FRAMEBUFFER,$,e.RENDERBUFFER,H)}}t.bindFramebuffer(e.FRAMEBUFFER,null)}function mt(m,s,L){const V=i.get(m);s!==void 0&&de(V.__webglFramebuffer,m,m.texture,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,0),L!==void 0&&He(m)}function _(m){const s=m.texture,L=i.get(m),V=i.get(s);m.addEventListener("dispose",D);const $=m.textures,H=m.isWebGLCubeRenderTarget===!0,Se=$.length>1;if(Se||(V.__webglTexture===void 0&&(V.__webglTexture=e.createTexture()),V.__version=s.version,p.memory.textures++),H){L.__webglFramebuffer=[];for(let te=0;te<6;te++)if(s.mipmaps&&s.mipmaps.length>0){L.__webglFramebuffer[te]=[];for(let _e=0;_e<s.mipmaps.length;_e++)L.__webglFramebuffer[te][_e]=e.createFramebuffer()}else L.__webglFramebuffer[te]=e.createFramebuffer()}else{if(s.mipmaps&&s.mipmaps.length>0){L.__webglFramebuffer=[];for(let te=0;te<s.mipmaps.length;te++)L.__webglFramebuffer[te]=e.createFramebuffer()}else L.__webglFramebuffer=e.createFramebuffer();if(Se)for(let te=0,_e=$.length;te<_e;te++){const ge=i.get($[te]);ge.__webglTexture===void 0&&(ge.__webglTexture=e.createTexture(),p.memory.textures++)}if(m.samples>0&&me(m)===!1){L.__webglMultisampledFramebuffer=e.createFramebuffer(),L.__webglColorRenderbuffer=[],t.bindFramebuffer(e.FRAMEBUFFER,L.__webglMultisampledFramebuffer);for(let te=0;te<$.length;te++){const _e=$[te];L.__webglColorRenderbuffer[te]=e.createRenderbuffer(),e.bindRenderbuffer(e.RENDERBUFFER,L.__webglColorRenderbuffer[te]);const ge=r.convert(_e.format,_e.colorSpace),J=r.convert(_e.type),ce=R(_e.internalFormat,ge,J,_e.colorSpace,m.isXRRenderTarget===!0),Ce=et(m);e.renderbufferStorageMultisample(e.RENDERBUFFER,Ce,ce,m.width,m.height),e.framebufferRenderbuffer(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0+te,e.RENDERBUFFER,L.__webglColorRenderbuffer[te])}e.bindRenderbuffer(e.RENDERBUFFER,null),m.depthBuffer&&(L.__webglDepthRenderbuffer=e.createRenderbuffer(),De(L.__webglDepthRenderbuffer,m,!0)),t.bindFramebuffer(e.FRAMEBUFFER,null)}}if(H){t.bindTexture(e.TEXTURE_CUBE_MAP,V.__webglTexture),ze(e.TEXTURE_CUBE_MAP,s);for(let te=0;te<6;te++)if(s.mipmaps&&s.mipmaps.length>0)for(let _e=0;_e<s.mipmaps.length;_e++)de(L.__webglFramebuffer[te][_e],m,s,e.COLOR_ATTACHMENT0,e.TEXTURE_CUBE_MAP_POSITIVE_X+te,_e);else de(L.__webglFramebuffer[te],m,s,e.COLOR_ATTACHMENT0,e.TEXTURE_CUBE_MAP_POSITIVE_X+te,0);d(s)&&a(e.TEXTURE_CUBE_MAP),t.unbindTexture()}else if(Se){for(let te=0,_e=$.length;te<_e;te++){const ge=$[te],J=i.get(ge);let ce=e.TEXTURE_2D;(m.isWebGL3DRenderTarget||m.isWebGLArrayRenderTarget)&&(ce=m.isWebGL3DRenderTarget?e.TEXTURE_3D:e.TEXTURE_2D_ARRAY),t.bindTexture(ce,J.__webglTexture),ze(ce,ge),de(L.__webglFramebuffer,m,ge,e.COLOR_ATTACHMENT0+te,ce,0),d(ge)&&a(ce)}t.unbindTexture()}else{let te=e.TEXTURE_2D;if((m.isWebGL3DRenderTarget||m.isWebGLArrayRenderTarget)&&(te=m.isWebGL3DRenderTarget?e.TEXTURE_3D:e.TEXTURE_2D_ARRAY),t.bindTexture(te,V.__webglTexture),ze(te,s),s.mipmaps&&s.mipmaps.length>0)for(let _e=0;_e<s.mipmaps.length;_e++)de(L.__webglFramebuffer[_e],m,s,e.COLOR_ATTACHMENT0,te,_e);else de(L.__webglFramebuffer,m,s,e.COLOR_ATTACHMENT0,te,0);d(s)&&a(te),t.unbindTexture()}m.depthBuffer&&He(m)}function Je(m){const s=m.textures;for(let L=0,V=s.length;L<V;L++){const $=s[L];if(d($)){const H=U(m),Se=i.get($).__webglTexture;t.bindTexture(H,Se),a(H),t.unbindTexture()}}}const Ue=[],we=[];function he(m){if(m.samples>0){if(me(m)===!1){const s=m.textures,L=m.width,V=m.height;let $=e.COLOR_BUFFER_BIT;const H=m.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT,Se=i.get(m),te=s.length>1;if(te)for(let ge=0;ge<s.length;ge++)t.bindFramebuffer(e.FRAMEBUFFER,Se.__webglMultisampledFramebuffer),e.framebufferRenderbuffer(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0+ge,e.RENDERBUFFER,null),t.bindFramebuffer(e.FRAMEBUFFER,Se.__webglFramebuffer),e.framebufferTexture2D(e.DRAW_FRAMEBUFFER,e.COLOR_ATTACHMENT0+ge,e.TEXTURE_2D,null,0);t.bindFramebuffer(e.READ_FRAMEBUFFER,Se.__webglMultisampledFramebuffer);const _e=m.texture.mipmaps;_e&&_e.length>0?t.bindFramebuffer(e.DRAW_FRAMEBUFFER,Se.__webglFramebuffer[0]):t.bindFramebuffer(e.DRAW_FRAMEBUFFER,Se.__webglFramebuffer);for(let ge=0;ge<s.length;ge++){if(m.resolveDepthBuffer&&(m.depthBuffer&&($|=e.DEPTH_BUFFER_BIT),m.stencilBuffer&&m.resolveStencilBuffer&&($|=e.STENCIL_BUFFER_BIT)),te){e.framebufferRenderbuffer(e.READ_FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.RENDERBUFFER,Se.__webglColorRenderbuffer[ge]);const J=i.get(s[ge]).__webglTexture;e.framebufferTexture2D(e.DRAW_FRAMEBUFFER,e.COLOR_ATTACHMENT0,e.TEXTURE_2D,J,0)}e.blitFramebuffer(0,0,L,V,0,0,L,V,$,e.NEAREST),x===!0&&(Ue.length=0,we.length=0,Ue.push(e.COLOR_ATTACHMENT0+ge),m.depthBuffer&&m.resolveDepthBuffer===!1&&(Ue.push(H),we.push(H),e.invalidateFramebuffer(e.DRAW_FRAMEBUFFER,we)),e.invalidateFramebuffer(e.READ_FRAMEBUFFER,Ue))}if(t.bindFramebuffer(e.READ_FRAMEBUFFER,null),t.bindFramebuffer(e.DRAW_FRAMEBUFFER,null),te)for(let ge=0;ge<s.length;ge++){t.bindFramebuffer(e.FRAMEBUFFER,Se.__webglMultisampledFramebuffer),e.framebufferRenderbuffer(e.FRAMEBUFFER,e.COLOR_ATTACHMENT0+ge,e.RENDERBUFFER,Se.__webglColorRenderbuffer[ge]);const J=i.get(s[ge]).__webglTexture;t.bindFramebuffer(e.FRAMEBUFFER,Se.__webglFramebuffer),e.framebufferTexture2D(e.DRAW_FRAMEBUFFER,e.COLOR_ATTACHMENT0+ge,e.TEXTURE_2D,J,0)}t.bindFramebuffer(e.DRAW_FRAMEBUFFER,Se.__webglMultisampledFramebuffer)}else if(m.depthBuffer&&m.resolveDepthBuffer===!1&&x){const s=m.stencilBuffer?e.DEPTH_STENCIL_ATTACHMENT:e.DEPTH_ATTACHMENT;e.invalidateFramebuffer(e.DRAW_FRAMEBUFFER,[s])}}}function et(m){return Math.min(o.maxSamples,m.samples)}function me(m){const s=i.get(m);return m.samples>0&&n.has("WEBGL_multisampled_render_to_texture")===!0&&s.__useRenderToTexture!==!1}function Fe(m){const s=p.render.frame;b.get(m)!==s&&(b.set(m,s),m.update())}function pt(m,s){const L=m.colorSpace,V=m.format,$=m.type;return m.isCompressedTexture===!0||m.isVideoTexture===!0||L!==ii&&L!==pn&&(ft.getTransfer(L)===Qe?(V!==Gt||$!==sn)&&console.warn("THREE.WebGLTextures: sRGB encoded textures have to use RGBAFormat and UnsignedByteType."):console.error("THREE.WebGLTextures: Unsupported texture color space:",L)),s}function ct(m){return typeof HTMLImageElement<"u"&&m instanceof HTMLImageElement?(M.width=m.naturalWidth||m.width,M.height=m.naturalHeight||m.height):typeof VideoFrame<"u"&&m instanceof VideoFrame?(M.width=m.displayWidth,M.height=m.displayHeight):(M.width=m.width,M.height=m.height),M}this.allocateTextureUnit=W,this.resetTextureUnits=F,this.setTexture2D=q,this.setTexture2DArray=Y,this.setTexture3D=re,this.setTextureCube=k,this.rebindTextures=mt,this.setupRenderTarget=_,this.updateRenderTargetMipmap=Je,this.updateMultisampleRenderTarget=he,this.setupDepthRenderbuffer=He,this.setupFrameBufferTexture=de,this.useMultisampledRTT=me}function fu(e,n){function t(i,o=pn){let r;const p=ft.getTransfer(o);if(i===sn)return e.UNSIGNED_BYTE;if(i===ua)return e.UNSIGNED_SHORT_4_4_4_4;if(i===pa)return e.UNSIGNED_SHORT_5_5_5_1;if(i===Bo)return e.UNSIGNED_INT_5_9_9_9_REV;if(i===Go)return e.UNSIGNED_INT_10F_11F_11F_REV;if(i===Ho)return e.BYTE;if(i===Vo)return e.SHORT;if(i===ei)return e.UNSIGNED_SHORT;if(i===ma)return e.INT;if(i===Nn)return e.UNSIGNED_INT;if(i===an)return e.FLOAT;if(i===ni)return e.HALF_FLOAT;if(i===ko)return e.ALPHA;if(i===Wo)return e.RGB;if(i===Gt)return e.RGBA;if(i===Fi)return e.DEPTH_COMPONENT;if(i===Qn)return e.DEPTH_STENCIL;if(i===zo)return e.RED;if(i===_a)return e.RED_INTEGER;if(i===Xo)return e.RG;if(i===ga)return e.RG_INTEGER;if(i===va)return e.RGBA_INTEGER;if(i===fi||i===di||i===ui||i===pi)if(p===Qe)if(r=n.get("WEBGL_compressed_texture_s3tc_srgb"),r!==null){if(i===fi)return r.COMPRESSED_SRGB_S3TC_DXT1_EXT;if(i===di)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT;if(i===ui)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT;if(i===pi)return r.COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT}else return null;else if(r=n.get("WEBGL_compressed_texture_s3tc"),r!==null){if(i===fi)return r.COMPRESSED_RGB_S3TC_DXT1_EXT;if(i===di)return r.COMPRESSED_RGBA_S3TC_DXT1_EXT;if(i===ui)return r.COMPRESSED_RGBA_S3TC_DXT3_EXT;if(i===pi)return r.COMPRESSED_RGBA_S3TC_DXT5_EXT}else return null;if(i===er||i===tr||i===nr||i===ir)if(r=n.get("WEBGL_compressed_texture_pvrtc"),r!==null){if(i===er)return r.COMPRESSED_RGB_PVRTC_4BPPV1_IMG;if(i===tr)return r.COMPRESSED_RGB_PVRTC_2BPPV1_IMG;if(i===nr)return r.COMPRESSED_RGBA_PVRTC_4BPPV1_IMG;if(i===ir)return r.COMPRESSED_RGBA_PVRTC_2BPPV1_IMG}else return null;if(i===rr||i===ar||i===or)if(r=n.get("WEBGL_compressed_texture_etc"),r!==null){if(i===rr||i===ar)return p===Qe?r.COMPRESSED_SRGB8_ETC2:r.COMPRESSED_RGB8_ETC2;if(i===or)return p===Qe?r.COMPRESSED_SRGB8_ALPHA8_ETC2_EAC:r.COMPRESSED_RGBA8_ETC2_EAC}else return null;if(i===sr||i===cr||i===lr||i===fr||i===dr||i===ur||i===pr||i===hr||i===mr||i===_r||i===gr||i===vr||i===Er||i===Sr)if(r=n.get("WEBGL_compressed_texture_astc"),r!==null){if(i===sr)return p===Qe?r.COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR:r.COMPRESSED_RGBA_ASTC_4x4_KHR;if(i===cr)return p===Qe?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR:r.COMPRESSED_RGBA_ASTC_5x4_KHR;if(i===lr)return p===Qe?r.COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR:r.COMPRESSED_RGBA_ASTC_5x5_KHR;if(i===fr)return p===Qe?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR:r.COMPRESSED_RGBA_ASTC_6x5_KHR;if(i===dr)return p===Qe?r.COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR:r.COMPRESSED_RGBA_ASTC_6x6_KHR;if(i===ur)return p===Qe?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR:r.COMPRESSED_RGBA_ASTC_8x5_KHR;if(i===pr)return p===Qe?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR:r.COMPRESSED_RGBA_ASTC_8x6_KHR;if(i===hr)return p===Qe?r.COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR:r.COMPRESSED_RGBA_ASTC_8x8_KHR;if(i===mr)return p===Qe?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR:r.COMPRESSED_RGBA_ASTC_10x5_KHR;if(i===_r)return p===Qe?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR:r.COMPRESSED_RGBA_ASTC_10x6_KHR;if(i===gr)return p===Qe?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR:r.COMPRESSED_RGBA_ASTC_10x8_KHR;if(i===vr)return p===Qe?r.COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR:r.COMPRESSED_RGBA_ASTC_10x10_KHR;if(i===Er)return p===Qe?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR:r.COMPRESSED_RGBA_ASTC_12x10_KHR;if(i===Sr)return p===Qe?r.COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR:r.COMPRESSED_RGBA_ASTC_12x12_KHR}else return null;if(i===Mr||i===Tr||i===xr)if(r=n.get("EXT_texture_compression_bptc"),r!==null){if(i===Mr)return p===Qe?r.COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT:r.COMPRESSED_RGBA_BPTC_UNORM_EXT;if(i===Tr)return r.COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT;if(i===xr)return r.COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT}else return null;if(i===Ar||i===Rr||i===Cr||i===br)if(r=n.get("EXT_texture_compression_rgtc"),r!==null){if(i===Ar)return r.COMPRESSED_RED_RGTC1_EXT;if(i===Rr)return r.COMPRESSED_SIGNED_RED_RGTC1_EXT;if(i===Cr)return r.COMPRESSED_RED_GREEN_RGTC2_EXT;if(i===br)return r.COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT}else return null;return i===In?e.UNSIGNED_INT_24_8:e[i]!==void 0?e[i]:null}return{convert:t}}const du=`
void main() {

	gl_Position = vec4( position, 1.0 );

}`,uu=`
uniform sampler2DArray depthColor;
uniform float depthWidth;
uniform float depthHeight;

void main() {

	vec2 coord = vec2( gl_FragCoord.x / depthWidth, gl_FragCoord.y / depthHeight );

	if ( coord.x >= 1.0 ) {

		gl_FragDepth = texture( depthColor, vec3( coord.x - 1.0, coord.y, 1 ) ).r;

	} else {

		gl_FragDepth = texture( depthColor, vec3( coord.x, coord.y, 0 ) ).r;

	}

}`;class pu{constructor(){this.texture=null,this.mesh=null,this.depthNear=0,this.depthFar=0}init(n,t){if(this.texture===null){const i=new ha(n.texture);(n.depthNear!==t.depthNear||n.depthFar!==t.depthFar)&&(this.depthNear=n.depthNear,this.depthFar=n.depthFar),this.texture=i}}getMesh(n){if(this.texture!==null&&this.mesh===null){const t=n.cameras[0].viewport,i=new cn({vertexShader:du,fragmentShader:uu,uniforms:{depthColor:{value:this.texture},depthWidth:{value:t.z},depthHeight:{value:t.w}}});this.mesh=new We(new ti(20,20),i)}return this.mesh}reset(){this.texture=null,this.mesh=null}getDepthTexture(){return this.texture}}class hu extends no{constructor(n,t){super();const i=this;let o=null,r=1,p=null,f="local-floor",x=1,M=null,b=null,v=null,S=null,T=null,B=null;const y=typeof XRWebGLBinding<"u",d=new pu,a={},U=t.getContextAttributes();let R=null,g=null;const O=[],P=[],D=new gt;let G=null;const h=new Dn;h.viewport=new Tt;const u=new Dn;u.viewport=new Tt;const A=[h,u],F=new io;let W=null,K=null;this.cameraAutoUpdate=!0,this.enabled=!1,this.isPresenting=!1,this.getController=function(z){let Z=O[z];return Z===void 0&&(Z=new ci,O[z]=Z),Z.getTargetRaySpace()},this.getControllerGrip=function(z){let Z=O[z];return Z===void 0&&(Z=new ci,O[z]=Z),Z.getGripSpace()},this.getHand=function(z){let Z=O[z];return Z===void 0&&(Z=new ci,O[z]=Z),Z.getHandSpace()};function q(z){const Z=P.indexOf(z.inputSource);if(Z===-1)return;const de=O[Z];de!==void 0&&(de.update(z.inputSource,z.frame,M||p),de.dispatchEvent({type:z.type,data:z.inputSource}))}function Y(){o.removeEventListener("select",q),o.removeEventListener("selectstart",q),o.removeEventListener("selectend",q),o.removeEventListener("squeeze",q),o.removeEventListener("squeezestart",q),o.removeEventListener("squeezeend",q),o.removeEventListener("end",Y),o.removeEventListener("inputsourceschange",re);for(let z=0;z<O.length;z++){const Z=P[z];Z!==null&&(P[z]=null,O[z].disconnect(Z))}W=null,K=null,d.reset();for(const z in a)delete a[z];n.setRenderTarget(R),T=null,S=null,v=null,o=null,g=null,qe.stop(),i.isPresenting=!1,n.setPixelRatio(G),n.setSize(D.width,D.height,!1),i.dispatchEvent({type:"sessionend"})}this.setFramebufferScaleFactor=function(z){r=z,i.isPresenting===!0&&console.warn("THREE.WebXRManager: Cannot change framebuffer scale while presenting.")},this.setReferenceSpaceType=function(z){f=z,i.isPresenting===!0&&console.warn("THREE.WebXRManager: Cannot change reference space type while presenting.")},this.getReferenceSpace=function(){return M||p},this.setReferenceSpace=function(z){M=z},this.getBaseLayer=function(){return S!==null?S:T},this.getBinding=function(){return v===null&&y&&(v=new XRWebGLBinding(o,t)),v},this.getFrame=function(){return B},this.getSession=function(){return o},this.setSession=async function(z){if(o=z,o!==null){if(R=n.getRenderTarget(),o.addEventListener("select",q),o.addEventListener("selectstart",q),o.addEventListener("selectend",q),o.addEventListener("squeeze",q),o.addEventListener("squeezestart",q),o.addEventListener("squeezeend",q),o.addEventListener("end",Y),o.addEventListener("inputsourceschange",re),U.xrCompatible!==!0&&await t.makeXRCompatible(),G=n.getPixelRatio(),n.getSize(D),y&&"createProjectionLayer"in XRWebGLBinding.prototype){let de=null,De=null,Me=null;U.depth&&(Me=U.stencil?t.DEPTH24_STENCIL8:t.DEPTH_COMPONENT24,de=U.stencil?Qn:Fi,De=U.stencil?In:Nn);const He={colorFormat:t.RGBA8,depthFormat:Me,scaleFactor:r};v=this.getBinding(),S=v.createProjectionLayer(He),o.updateRenderState({layers:[S]}),n.setPixelRatio(1),n.setSize(S.textureWidth,S.textureHeight,!1),g=new En(S.textureWidth,S.textureHeight,{format:Gt,type:sn,depthTexture:new la(S.textureWidth,S.textureHeight,De,void 0,void 0,void 0,void 0,void 0,void 0,de),stencilBuffer:U.stencil,colorSpace:n.outputColorSpace,samples:U.antialias?4:0,resolveDepthBuffer:S.ignoreDepthValues===!1,resolveStencilBuffer:S.ignoreDepthValues===!1})}else{const de={antialias:U.antialias,alpha:!0,depth:U.depth,stencil:U.stencil,framebufferScaleFactor:r};T=new XRWebGLLayer(o,t,de),o.updateRenderState({baseLayer:T}),n.setPixelRatio(1),n.setSize(T.framebufferWidth,T.framebufferHeight,!1),g=new En(T.framebufferWidth,T.framebufferHeight,{format:Gt,type:sn,colorSpace:n.outputColorSpace,stencilBuffer:U.stencil,resolveDepthBuffer:T.ignoreDepthValues===!1,resolveStencilBuffer:T.ignoreDepthValues===!1})}g.isXRRenderTarget=!0,this.setFoveation(x),M=null,p=await o.requestReferenceSpace(f),qe.setContext(o),qe.start(),i.isPresenting=!0,i.dispatchEvent({type:"sessionstart"})}},this.getEnvironmentBlendMode=function(){if(o!==null)return o.environmentBlendMode},this.getDepthTexture=function(){return d.getDepthTexture()};function re(z){for(let Z=0;Z<z.removed.length;Z++){const de=z.removed[Z],De=P.indexOf(de);De>=0&&(P[De]=null,O[De].disconnect(de))}for(let Z=0;Z<z.added.length;Z++){const de=z.added[Z];let De=P.indexOf(de);if(De===-1){for(let He=0;He<O.length;He++)if(He>=P.length){P.push(de),De=He;break}else if(P[He]===null){P[He]=de,De=He;break}if(De===-1)break}const Me=O[De];Me&&Me.connect(de)}}const k=new Le,Ee=new Le;function Ae(z,Z,de){k.setFromMatrixPosition(Z.matrixWorld),Ee.setFromMatrixPosition(de.matrixWorld);const De=k.distanceTo(Ee),Me=Z.projectionMatrix.elements,He=de.projectionMatrix.elements,mt=Me[14]/(Me[10]-1),_=Me[14]/(Me[10]+1),Je=(Me[9]+1)/Me[5],Ue=(Me[9]-1)/Me[5],we=(Me[8]-1)/Me[0],he=(He[8]+1)/He[0],et=mt*we,me=mt*he,Fe=De/(-we+he),pt=Fe*-we;if(Z.matrixWorld.decompose(z.position,z.quaternion,z.scale),z.translateX(pt),z.translateZ(Fe),z.matrixWorld.compose(z.position,z.quaternion,z.scale),z.matrixWorldInverse.copy(z.matrixWorld).invert(),Me[10]===-1)z.projectionMatrix.copy(Z.projectionMatrix),z.projectionMatrixInverse.copy(Z.projectionMatrixInverse);else{const ct=mt+Fe,m=_+Fe,s=et-pt,L=me+(De-pt),V=Je*_/m*ct,$=Ue*_/m*ct;z.projectionMatrix.makePerspective(s,L,V,$,ct,m),z.projectionMatrixInverse.copy(z.projectionMatrix).invert()}}function Oe(z,Z){Z===null?z.matrixWorld.copy(z.matrix):z.matrixWorld.multiplyMatrices(Z.matrixWorld,z.matrix),z.matrixWorldInverse.copy(z.matrixWorld).invert()}this.updateCamera=function(z){if(o===null)return;let Z=z.near,de=z.far;d.texture!==null&&(d.depthNear>0&&(Z=d.depthNear),d.depthFar>0&&(de=d.depthFar)),F.near=u.near=h.near=Z,F.far=u.far=h.far=de,(W!==F.near||K!==F.far)&&(o.updateRenderState({depthNear:F.near,depthFar:F.far}),W=F.near,K=F.far),F.layers.mask=z.layers.mask|6,h.layers.mask=F.layers.mask&3,u.layers.mask=F.layers.mask&5;const De=z.parent,Me=F.cameras;Oe(F,De);for(let He=0;He<Me.length;He++)Oe(Me[He],De);Me.length===2?Ae(F,h,u):F.projectionMatrix.copy(h.projectionMatrix),ze(z,F,De)};function ze(z,Z,de){de===null?z.matrix.copy(Z.matrixWorld):(z.matrix.copy(de.matrixWorld),z.matrix.invert(),z.matrix.multiply(Z.matrixWorld)),z.matrix.decompose(z.position,z.quaternion,z.scale),z.updateMatrixWorld(!0),z.projectionMatrix.copy(Z.projectionMatrix),z.projectionMatrixInverse.copy(Z.projectionMatrixInverse),z.isPerspectiveCamera&&(z.fov=ro*2*Math.atan(1/z.projectionMatrix.elements[5]),z.zoom=1)}this.getCamera=function(){return F},this.getFoveation=function(){if(!(S===null&&T===null))return x},this.setFoveation=function(z){x=z,S!==null&&(S.fixedFoveation=z),T!==null&&T.fixedFoveation!==void 0&&(T.fixedFoveation=z)},this.hasDepthSensing=function(){return d.texture!==null},this.getDepthSensingMesh=function(){return d.getMesh(F)},this.getCameraTexture=function(z){return a[z]};let st=null;function rt(z,Z){if(b=Z.getViewerPose(M||p),B=Z,b!==null){const de=b.views;T!==null&&(n.setRenderTargetFramebuffer(g,T.framebuffer),n.setRenderTarget(g));let De=!1;de.length!==F.cameras.length&&(F.cameras.length=0,De=!0);for(let _=0;_<de.length;_++){const Je=de[_];let Ue=null;if(T!==null)Ue=T.getViewport(Je);else{const he=v.getViewSubImage(S,Je);Ue=he.viewport,_===0&&(n.setRenderTargetTextures(g,he.colorTexture,he.depthStencilTexture),n.setRenderTarget(g))}let we=A[_];we===void 0&&(we=new Dn,we.layers.enable(_),we.viewport=new Tt,A[_]=we),we.matrix.fromArray(Je.transform.matrix),we.matrix.decompose(we.position,we.quaternion,we.scale),we.projectionMatrix.fromArray(Je.projectionMatrix),we.projectionMatrixInverse.copy(we.projectionMatrix).invert(),we.viewport.set(Ue.x,Ue.y,Ue.width,Ue.height),_===0&&(F.matrix.copy(we.matrix),F.matrix.decompose(F.position,F.quaternion,F.scale)),De===!0&&F.cameras.push(we)}const Me=o.enabledFeatures;if(Me&&Me.includes("depth-sensing")&&o.depthUsage=="gpu-optimized"&&y){v=i.getBinding();const _=v.getDepthInformation(de[0]);_&&_.isValid&&_.texture&&d.init(_,o.renderState)}if(Me&&Me.includes("camera-access")&&y){n.state.unbindTexture(),v=i.getBinding();for(let _=0;_<de.length;_++){const Je=de[_].camera;if(Je){let Ue=a[Je];Ue||(Ue=new ha,a[Je]=Ue);const we=v.getCameraImage(Je);Ue.sourceTexture=we}}}}for(let de=0;de<O.length;de++){const De=P[de],Me=O[de];De!==null&&Me!==void 0&&Me.update(De,Z,M||p)}st&&st(z,Z),Z.detectedPlanes&&i.dispatchEvent({type:"planesdetected",data:Z}),B=null}const qe=new La;qe.setAnimationLoop(rt),this.setAnimationLoop=function(z){st=z},this.dispose=function(){}}}const en=new Gi,mu=new vn;function _u(e,n){function t(d,a){d.matrixAutoUpdate===!0&&d.updateMatrix(),a.value.copy(d.matrix)}function i(d,a){a.color.getRGB(d.fogColor.value,Sa(e)),a.isFog?(d.fogNear.value=a.near,d.fogFar.value=a.far):a.isFogExp2&&(d.fogDensity.value=a.density)}function o(d,a,U,R,g){a.isMeshBasicMaterial||a.isMeshLambertMaterial?r(d,a):a.isMeshToonMaterial?(r(d,a),v(d,a)):a.isMeshPhongMaterial?(r(d,a),b(d,a)):a.isMeshStandardMaterial?(r(d,a),S(d,a),a.isMeshPhysicalMaterial&&T(d,a,g)):a.isMeshMatcapMaterial?(r(d,a),B(d,a)):a.isMeshDepthMaterial?r(d,a):a.isMeshDistanceMaterial?(r(d,a),y(d,a)):a.isMeshNormalMaterial?r(d,a):a.isLineBasicMaterial?(p(d,a),a.isLineDashedMaterial&&f(d,a)):a.isPointsMaterial?x(d,a,U,R):a.isSpriteMaterial?M(d,a):a.isShadowMaterial?(d.color.value.copy(a.color),d.opacity.value=a.opacity):a.isShaderMaterial&&(a.uniformsNeedUpdate=!1)}function r(d,a){d.opacity.value=a.opacity,a.color&&d.diffuse.value.copy(a.color),a.emissive&&d.emissive.value.copy(a.emissive).multiplyScalar(a.emissiveIntensity),a.map&&(d.map.value=a.map,t(a.map,d.mapTransform)),a.alphaMap&&(d.alphaMap.value=a.alphaMap,t(a.alphaMap,d.alphaMapTransform)),a.bumpMap&&(d.bumpMap.value=a.bumpMap,t(a.bumpMap,d.bumpMapTransform),d.bumpScale.value=a.bumpScale,a.side===Rt&&(d.bumpScale.value*=-1)),a.normalMap&&(d.normalMap.value=a.normalMap,t(a.normalMap,d.normalMapTransform),d.normalScale.value.copy(a.normalScale),a.side===Rt&&d.normalScale.value.negate()),a.displacementMap&&(d.displacementMap.value=a.displacementMap,t(a.displacementMap,d.displacementMapTransform),d.displacementScale.value=a.displacementScale,d.displacementBias.value=a.displacementBias),a.emissiveMap&&(d.emissiveMap.value=a.emissiveMap,t(a.emissiveMap,d.emissiveMapTransform)),a.specularMap&&(d.specularMap.value=a.specularMap,t(a.specularMap,d.specularMapTransform)),a.alphaTest>0&&(d.alphaTest.value=a.alphaTest);const U=n.get(a),R=U.envMap,g=U.envMapRotation;R&&(d.envMap.value=R,en.copy(g),en.x*=-1,en.y*=-1,en.z*=-1,R.isCubeTexture&&R.isRenderTargetTexture===!1&&(en.y*=-1,en.z*=-1),d.envMapRotation.value.setFromMatrix4(mu.makeRotationFromEuler(en)),d.flipEnvMap.value=R.isCubeTexture&&R.isRenderTargetTexture===!1?-1:1,d.reflectivity.value=a.reflectivity,d.ior.value=a.ior,d.refractionRatio.value=a.refractionRatio),a.lightMap&&(d.lightMap.value=a.lightMap,d.lightMapIntensity.value=a.lightMapIntensity,t(a.lightMap,d.lightMapTransform)),a.aoMap&&(d.aoMap.value=a.aoMap,d.aoMapIntensity.value=a.aoMapIntensity,t(a.aoMap,d.aoMapTransform))}function p(d,a){d.diffuse.value.copy(a.color),d.opacity.value=a.opacity,a.map&&(d.map.value=a.map,t(a.map,d.mapTransform))}function f(d,a){d.dashSize.value=a.dashSize,d.totalSize.value=a.dashSize+a.gapSize,d.scale.value=a.scale}function x(d,a,U,R){d.diffuse.value.copy(a.color),d.opacity.value=a.opacity,d.size.value=a.size*U,d.scale.value=R*.5,a.map&&(d.map.value=a.map,t(a.map,d.uvTransform)),a.alphaMap&&(d.alphaMap.value=a.alphaMap,t(a.alphaMap,d.alphaMapTransform)),a.alphaTest>0&&(d.alphaTest.value=a.alphaTest)}function M(d,a){d.diffuse.value.copy(a.color),d.opacity.value=a.opacity,d.rotation.value=a.rotation,a.map&&(d.map.value=a.map,t(a.map,d.mapTransform)),a.alphaMap&&(d.alphaMap.value=a.alphaMap,t(a.alphaMap,d.alphaMapTransform)),a.alphaTest>0&&(d.alphaTest.value=a.alphaTest)}function b(d,a){d.specular.value.copy(a.specular),d.shininess.value=Math.max(a.shininess,1e-4)}function v(d,a){a.gradientMap&&(d.gradientMap.value=a.gradientMap)}function S(d,a){d.metalness.value=a.metalness,a.metalnessMap&&(d.metalnessMap.value=a.metalnessMap,t(a.metalnessMap,d.metalnessMapTransform)),d.roughness.value=a.roughness,a.roughnessMap&&(d.roughnessMap.value=a.roughnessMap,t(a.roughnessMap,d.roughnessMapTransform)),a.envMap&&(d.envMapIntensity.value=a.envMapIntensity)}function T(d,a,U){d.ior.value=a.ior,a.sheen>0&&(d.sheenColor.value.copy(a.sheenColor).multiplyScalar(a.sheen),d.sheenRoughness.value=a.sheenRoughness,a.sheenColorMap&&(d.sheenColorMap.value=a.sheenColorMap,t(a.sheenColorMap,d.sheenColorMapTransform)),a.sheenRoughnessMap&&(d.sheenRoughnessMap.value=a.sheenRoughnessMap,t(a.sheenRoughnessMap,d.sheenRoughnessMapTransform))),a.clearcoat>0&&(d.clearcoat.value=a.clearcoat,d.clearcoatRoughness.value=a.clearcoatRoughness,a.clearcoatMap&&(d.clearcoatMap.value=a.clearcoatMap,t(a.clearcoatMap,d.clearcoatMapTransform)),a.clearcoatRoughnessMap&&(d.clearcoatRoughnessMap.value=a.clearcoatRoughnessMap,t(a.clearcoatRoughnessMap,d.clearcoatRoughnessMapTransform)),a.clearcoatNormalMap&&(d.clearcoatNormalMap.value=a.clearcoatNormalMap,t(a.clearcoatNormalMap,d.clearcoatNormalMapTransform),d.clearcoatNormalScale.value.copy(a.clearcoatNormalScale),a.side===Rt&&d.clearcoatNormalScale.value.negate())),a.dispersion>0&&(d.dispersion.value=a.dispersion),a.iridescence>0&&(d.iridescence.value=a.iridescence,d.iridescenceIOR.value=a.iridescenceIOR,d.iridescenceThicknessMinimum.value=a.iridescenceThicknessRange[0],d.iridescenceThicknessMaximum.value=a.iridescenceThicknessRange[1],a.iridescenceMap&&(d.iridescenceMap.value=a.iridescenceMap,t(a.iridescenceMap,d.iridescenceMapTransform)),a.iridescenceThicknessMap&&(d.iridescenceThicknessMap.value=a.iridescenceThicknessMap,t(a.iridescenceThicknessMap,d.iridescenceThicknessMapTransform))),a.transmission>0&&(d.transmission.value=a.transmission,d.transmissionSamplerMap.value=U.texture,d.transmissionSamplerSize.value.set(U.width,U.height),a.transmissionMap&&(d.transmissionMap.value=a.transmissionMap,t(a.transmissionMap,d.transmissionMapTransform)),d.thickness.value=a.thickness,a.thicknessMap&&(d.thicknessMap.value=a.thicknessMap,t(a.thicknessMap,d.thicknessMapTransform)),d.attenuationDistance.value=a.attenuationDistance,d.attenuationColor.value.copy(a.attenuationColor)),a.anisotropy>0&&(d.anisotropyVector.value.set(a.anisotropy*Math.cos(a.anisotropyRotation),a.anisotropy*Math.sin(a.anisotropyRotation)),a.anisotropyMap&&(d.anisotropyMap.value=a.anisotropyMap,t(a.anisotropyMap,d.anisotropyMapTransform))),d.specularIntensity.value=a.specularIntensity,d.specularColor.value.copy(a.specularColor),a.specularColorMap&&(d.specularColorMap.value=a.specularColorMap,t(a.specularColorMap,d.specularColorMapTransform)),a.specularIntensityMap&&(d.specularIntensityMap.value=a.specularIntensityMap,t(a.specularIntensityMap,d.specularIntensityMapTransform))}function B(d,a){a.matcap&&(d.matcap.value=a.matcap)}function y(d,a){const U=n.get(a).light;d.referencePosition.value.setFromMatrixPosition(U.matrixWorld),d.nearDistance.value=U.shadow.camera.near,d.farDistance.value=U.shadow.camera.far}return{refreshFogUniforms:i,refreshMaterialUniforms:o}}function gu(e,n,t,i){let o={},r={},p=[];const f=e.getParameter(e.MAX_UNIFORM_BUFFER_BINDINGS);function x(U,R){const g=R.program;i.uniformBlockBinding(U,g)}function M(U,R){let g=o[U.id];g===void 0&&(B(U),g=b(U),o[U.id]=g,U.addEventListener("dispose",d));const O=R.program;i.updateUBOMapping(U,O);const P=n.render.frame;r[U.id]!==P&&(S(U),r[U.id]=P)}function b(U){const R=v();U.__bindingPointIndex=R;const g=e.createBuffer(),O=U.__size,P=U.usage;return e.bindBuffer(e.UNIFORM_BUFFER,g),e.bufferData(e.UNIFORM_BUFFER,O,P),e.bindBuffer(e.UNIFORM_BUFFER,null),e.bindBufferBase(e.UNIFORM_BUFFER,R,g),g}function v(){for(let U=0;U<f;U++)if(p.indexOf(U)===-1)return p.push(U),U;return console.error("THREE.WebGLRenderer: Maximum number of simultaneously usable uniforms groups reached."),0}function S(U){const R=o[U.id],g=U.uniforms,O=U.__cache;e.bindBuffer(e.UNIFORM_BUFFER,R);for(let P=0,D=g.length;P<D;P++){const G=Array.isArray(g[P])?g[P]:[g[P]];for(let h=0,u=G.length;h<u;h++){const A=G[h];if(T(A,P,h,O)===!0){const F=A.__offset,W=Array.isArray(A.value)?A.value:[A.value];let K=0;for(let q=0;q<W.length;q++){const Y=W[q],re=y(Y);typeof Y=="number"||typeof Y=="boolean"?(A.__data[0]=Y,e.bufferSubData(e.UNIFORM_BUFFER,F+K,A.__data)):Y.isMatrix3?(A.__data[0]=Y.elements[0],A.__data[1]=Y.elements[1],A.__data[2]=Y.elements[2],A.__data[3]=0,A.__data[4]=Y.elements[3],A.__data[5]=Y.elements[4],A.__data[6]=Y.elements[5],A.__data[7]=0,A.__data[8]=Y.elements[6],A.__data[9]=Y.elements[7],A.__data[10]=Y.elements[8],A.__data[11]=0):(Y.toArray(A.__data,K),K+=re.storage/Float32Array.BYTES_PER_ELEMENT)}e.bufferSubData(e.UNIFORM_BUFFER,F,A.__data)}}}e.bindBuffer(e.UNIFORM_BUFFER,null)}function T(U,R,g,O){const P=U.value,D=R+"_"+g;if(O[D]===void 0)return typeof P=="number"||typeof P=="boolean"?O[D]=P:O[D]=P.clone(),!0;{const G=O[D];if(typeof P=="number"||typeof P=="boolean"){if(G!==P)return O[D]=P,!0}else if(G.equals(P)===!1)return G.copy(P),!0}return!1}function B(U){const R=U.uniforms;let g=0;const O=16;for(let D=0,G=R.length;D<G;D++){const h=Array.isArray(R[D])?R[D]:[R[D]];for(let u=0,A=h.length;u<A;u++){const F=h[u],W=Array.isArray(F.value)?F.value:[F.value];for(let K=0,q=W.length;K<q;K++){const Y=W[K],re=y(Y),k=g%O,Ee=k%re.boundary,Ae=k+Ee;g+=Ee,Ae!==0&&O-Ae<re.storage&&(g+=O-Ae),F.__data=new Float32Array(re.storage/Float32Array.BYTES_PER_ELEMENT),F.__offset=g,g+=re.storage}}}const P=g%O;return P>0&&(g+=O-P),U.__size=g,U.__cache={},this}function y(U){const R={boundary:0,storage:0};return typeof U=="number"||typeof U=="boolean"?(R.boundary=4,R.storage=4):U.isVector2?(R.boundary=8,R.storage=8):U.isVector3||U.isColor?(R.boundary=16,R.storage=12):U.isVector4?(R.boundary=16,R.storage=16):U.isMatrix3?(R.boundary=48,R.storage=48):U.isMatrix4?(R.boundary=64,R.storage=64):U.isTexture?console.warn("THREE.WebGLRenderer: Texture samplers can not be part of an uniforms group."):console.warn("THREE.WebGLRenderer: Unsupported uniform value type.",U),R}function d(U){const R=U.target;R.removeEventListener("dispose",d);const g=p.indexOf(R.__bindingPointIndex);p.splice(g,1),e.deleteBuffer(o[R.id]),delete o[R.id],delete r[R.id]}function a(){for(const U in o)e.deleteBuffer(o[U]);p=[],o={},r={}}return{bind:x,update:M,dispose:a}}class vu{constructor(n={}){const{canvas:t=Ja(),context:i=null,depth:o=!0,stencil:r=!1,alpha:p=!1,antialias:f=!1,premultipliedAlpha:x=!0,preserveDrawingBuffer:M=!1,powerPreference:b="default",failIfMajorPerformanceCaveat:v=!1,reversedDepthBuffer:S=!1}=n;this.isWebGLRenderer=!0;let T;if(i!==null){if(typeof WebGLRenderingContext<"u"&&i instanceof WebGLRenderingContext)throw new Error("THREE.WebGLRenderer: WebGL 1 is not supported since r163.");T=i.getContextAttributes().alpha}else T=p;const B=new Uint32Array(4),y=new Int32Array(4);let d=null,a=null;const U=[],R=[];this.domElement=t,this.debug={checkShaderErrors:!0,onShaderError:null},this.autoClear=!0,this.autoClearColor=!0,this.autoClearDepth=!0,this.autoClearStencil=!0,this.sortObjects=!0,this.clippingPlanes=[],this.localClippingEnabled=!1,this.toneMapping=Zt,this.toneMappingExposure=1,this.transmissionResolutionScale=1;const g=this;let O=!1;this._outputColorSpace=Oi;let P=0,D=0,G=null,h=-1,u=null;const A=new Tt,F=new Tt;let W=null;const K=new Ye(0);let q=0,Y=t.width,re=t.height,k=1,Ee=null,Ae=null;const Oe=new Tt(0,0,Y,re),ze=new Tt(0,0,Y,re);let st=!1;const rt=new ca;let qe=!1,z=!1;const Z=new vn,de=new Le,De=new Tt,Me={background:null,fog:null,environment:null,overrideMaterial:null,isScene:!0};let He=!1;function mt(){return G===null?k:1}let _=i;function Je(c,C){return t.getContext(c,C)}try{const c={alpha:!0,depth:o,stencil:r,antialias:f,premultipliedAlpha:x,preserveDrawingBuffer:M,powerPreference:b,failIfMajorPerformanceCaveat:v};if("setAttribute"in t&&t.setAttribute("data-engine",`three.js r${eo}`),t.addEventListener("webglcontextlost",ne,!1),t.addEventListener("webglcontextrestored",fe,!1),t.addEventListener("webglcontextcreationerror",j,!1),_===null){const C="webgl2";if(_=Je(C,c),_===null)throw Je(C)?new Error("Error creating WebGL context with your selected attributes."):new Error("Error creating WebGL context.")}}catch(c){throw console.error("THREE.WebGLRenderer: "+c.message),c}let Ue,we,he,et,me,Fe,pt,ct,m,s,L,V,$,H,Se,te,_e,ge,J,ce,Ce,ve,oe,Ne;function E(){Ue=new wf(_),Ue.init(),ve=new fu(_,Ue),we=new Mf(_,Ue,n,ve),he=new cu(_,Ue),we.reversedDepthBuffer&&S&&he.buffers.depth.setReversed(!0),et=new Df(_),me=new $d,Fe=new lu(_,Ue,he,me,we,ve,et),pt=new xf(g),ct=new bf(g),m=new Os(_),oe=new Ef(_,m),s=new Pf(_,m,et,oe),L=new Uf(_,s,m,et),J=new yf(_,we,Fe),te=new Tf(me),V=new qd(g,pt,ct,Ue,we,oe,te),$=new _u(g,me),H=new jd,Se=new iu(Ue),ge=new vf(g,pt,ct,he,L,T,x),_e=new ou(g,L,we),Ne=new gu(_,et,we,he),ce=new Sf(_,Ue,et),Ce=new Lf(_,Ue,et),et.programs=V.programs,g.capabilities=we,g.extensions=Ue,g.properties=me,g.renderLists=H,g.shadowMap=_e,g.state=he,g.info=et}E();const ee=new hu(g,_);this.xr=ee,this.getContext=function(){return _},this.getContextAttributes=function(){return _.getContextAttributes()},this.forceContextLoss=function(){const c=Ue.get("WEBGL_lose_context");c&&c.loseContext()},this.forceContextRestore=function(){const c=Ue.get("WEBGL_lose_context");c&&c.restoreContext()},this.getPixelRatio=function(){return k},this.setPixelRatio=function(c){c!==void 0&&(k=c,this.setSize(Y,re,!1))},this.getSize=function(c){return c.set(Y,re)},this.setSize=function(c,C,I=!0){if(ee.isPresenting){console.warn("THREE.WebGLRenderer: Can't change size while VR device is presenting.");return}Y=c,re=C,t.width=Math.floor(c*k),t.height=Math.floor(C*k),I===!0&&(t.style.width=c+"px",t.style.height=C+"px"),this.setViewport(0,0,c,C)},this.getDrawingBufferSize=function(c){return c.set(Y*k,re*k).floor()},this.setDrawingBufferSize=function(c,C,I){Y=c,re=C,k=I,t.width=Math.floor(c*I),t.height=Math.floor(C*I),this.setViewport(0,0,c,C)},this.getCurrentViewport=function(c){return c.copy(A)},this.getViewport=function(c){return c.copy(Oe)},this.setViewport=function(c,C,I,N){c.isVector4?Oe.set(c.x,c.y,c.z,c.w):Oe.set(c,C,I,N),he.viewport(A.copy(Oe).multiplyScalar(k).round())},this.getScissor=function(c){return c.copy(ze)},this.setScissor=function(c,C,I,N){c.isVector4?ze.set(c.x,c.y,c.z,c.w):ze.set(c,C,I,N),he.scissor(F.copy(ze).multiplyScalar(k).round())},this.getScissorTest=function(){return st},this.setScissorTest=function(c){he.setScissorTest(st=c)},this.setOpaqueSort=function(c){Ee=c},this.setTransparentSort=function(c){Ae=c},this.getClearColor=function(c){return c.copy(ge.getClearColor())},this.setClearColor=function(){ge.setClearColor(...arguments)},this.getClearAlpha=function(){return ge.getClearAlpha()},this.setClearAlpha=function(){ge.setClearAlpha(...arguments)},this.clear=function(c=!0,C=!0,I=!0){let N=0;if(c){let w=!1;if(G!==null){const Q=G.texture.format;w=Q===va||Q===ga||Q===_a}if(w){const Q=G.texture.type,se=Q===sn||Q===Nn||Q===ei||Q===In||Q===ua||Q===pa,ue=ge.getClearColor(),le=ge.getClearAlpha(),Re=ue.r,Pe=ue.g,Te=ue.b;se?(B[0]=Re,B[1]=Pe,B[2]=Te,B[3]=le,_.clearBufferuiv(_.COLOR,0,B)):(y[0]=Re,y[1]=Pe,y[2]=Te,y[3]=le,_.clearBufferiv(_.COLOR,0,y))}else N|=_.COLOR_BUFFER_BIT}C&&(N|=_.DEPTH_BUFFER_BIT),I&&(N|=_.STENCIL_BUFFER_BIT,this.state.buffers.stencil.setMask(4294967295)),_.clear(N)},this.clearColor=function(){this.clear(!0,!1,!1)},this.clearDepth=function(){this.clear(!1,!0,!1)},this.clearStencil=function(){this.clear(!1,!1,!0)},this.dispose=function(){t.removeEventListener("webglcontextlost",ne,!1),t.removeEventListener("webglcontextrestored",fe,!1),t.removeEventListener("webglcontextcreationerror",j,!1),ge.dispose(),H.dispose(),Se.dispose(),me.dispose(),pt.dispose(),ct.dispose(),L.dispose(),oe.dispose(),Ne.dispose(),V.dispose(),ee.dispose(),ee.removeEventListener("sessionstart",Ut),ee.removeEventListener("sessionend",Yi),jt.stop()};function ne(c){c.preventDefault(),console.log("THREE.WebGLRenderer: Context Lost."),O=!0}function fe(){console.log("THREE.WebGLRenderer: Context Restored."),O=!1;const c=et.autoReset,C=_e.enabled,I=_e.autoUpdate,N=_e.needsUpdate,w=_e.type;E(),et.autoReset=c,_e.enabled=C,_e.autoUpdate=I,_e.needsUpdate=N,_e.type=w}function j(c){console.error("THREE.WebGLRenderer: A WebGL context could not be created. Reason: ",c.statusMessage)}function X(c){const C=c.target;C.removeEventListener("dispose",X),pe(C)}function pe(c){ye(c),me.remove(c)}function ye(c){const C=me.get(c).programs;C!==void 0&&(C.forEach(function(I){V.releaseProgram(I)}),c.isShaderMaterial&&V.releaseShaderCache(c))}this.renderBufferDirect=function(c,C,I,N,w,Q){C===null&&(C=Me);const se=w.isMesh&&w.matrixWorld.determinant()<0,ue=Ya(c,C,I,N,w);he.setMaterial(N,se);let le=I.index,Re=1;if(N.wireframe===!0){if(le=s.getWireframeAttribute(I),le===void 0)return;Re=2}const Pe=I.drawRange,Te=I.attributes.position;let Ge=Pe.start*Re,Ke=(Pe.start+Pe.count)*Re;Q!==null&&(Ge=Math.max(Ge,Q.start*Re),Ke=Math.min(Ke,(Q.start+Q.count)*Re)),le!==null?(Ge=Math.max(Ge,0),Ke=Math.min(Ke,le.count)):Te!=null&&(Ge=Math.max(Ge,0),Ke=Math.min(Ke,Te.count));const at=Ke-Ge;if(at<0||at===1/0)return;oe.setup(w,N,ue,I,le);let je,$e=ce;if(le!==null&&(je=m.get(le),$e=Ce,$e.setIndex(je)),w.isMesh)N.wireframe===!0?(he.setLineWidth(N.wireframeLinewidth*mt()),$e.setMode(_.LINES)):$e.setMode(_.TRIANGLES);else if(w.isLine){let xe=N.linewidth;xe===void 0&&(xe=1),he.setLineWidth(xe*mt()),w.isLineSegments?$e.setMode(_.LINES):w.isLineLoop?$e.setMode(_.LINE_LOOP):$e.setMode(_.LINE_STRIP)}else w.isPoints?$e.setMode(_.POINTS):w.isSprite&&$e.setMode(_.TRIANGLES);if(w.isBatchedMesh)if(w._multiDrawInstances!==null)Mi("THREE.WebGLRenderer: renderMultiDrawInstances has been deprecated and will be removed in r184. Append to renderMultiDraw arguments and use indirection."),$e.renderMultiDrawInstances(w._multiDrawStarts,w._multiDrawCounts,w._multiDrawCount,w._multiDrawInstances);else if(Ue.get("WEBGL_multi_draw"))$e.renderMultiDraw(w._multiDrawStarts,w._multiDrawCounts,w._multiDrawCount);else{const xe=w._multiDrawStarts,nt=w._multiDrawCounts,Ve=w._multiDrawCount,xt=le?m.get(le).bytesPerElement:1,fn=me.get(N).currentProgram.getUniforms();for(let At=0;At<Ve;At++)fn.setValue(_,"_gl_DrawID",At),$e.render(xe[At]/xt,nt[At])}else if(w.isInstancedMesh)$e.renderInstances(Ge,at,w.count);else if(I.isInstancedBufferGeometry){const xe=I._maxInstanceCount!==void 0?I._maxInstanceCount:1/0,nt=Math.min(I.instanceCount,xe);$e.renderInstances(Ge,at,nt)}else $e.render(Ge,at)};function Ze(c,C,I){c.transparent===!0&&c.side===Dt&&c.forceSinglePass===!1?(c.side=Rt,c.needsUpdate=!0,kn(c,C,I),c.side=Un,c.needsUpdate=!0,kn(c,C,I),c.side=Dt):kn(c,C,I)}this.compile=function(c,C,I=null){I===null&&(I=c),a=Se.get(I),a.init(C),R.push(a),I.traverseVisible(function(w){w.isLight&&w.layers.test(C.layers)&&(a.pushLight(w),w.castShadow&&a.pushShadow(w))}),c!==I&&c.traverseVisible(function(w){w.isLight&&w.layers.test(C.layers)&&(a.pushLight(w),w.castShadow&&a.pushShadow(w))}),a.setupLights();const N=new Set;return c.traverse(function(w){if(!(w.isMesh||w.isPoints||w.isLine||w.isSprite))return;const Q=w.material;if(Q)if(Array.isArray(Q))for(let se=0;se<Q.length;se++){const ue=Q[se];Ze(ue,I,w),N.add(ue)}else Ze(Q,I,w),N.add(Q)}),a=R.pop(),N},this.compileAsync=function(c,C,I=null){const N=this.compile(c,C,I);return new Promise(w=>{function Q(){if(N.forEach(function(se){me.get(se).currentProgram.isReady()&&N.delete(se)}),N.size===0){w(c);return}setTimeout(Q,10)}Ue.get("KHR_parallel_shader_compile")!==null?Q():setTimeout(Q,10)})};let Xe=null;function Ft(c){Xe&&Xe(c)}function Ut(){jt.stop()}function Yi(){jt.start()}const jt=new La;jt.setAnimationLoop(Ft),typeof self<"u"&&jt.setContext(self),this.setAnimationLoop=function(c){Xe=c,ee.setAnimationLoop(c),c===null?jt.stop():jt.start()},ee.addEventListener("sessionstart",Ut),ee.addEventListener("sessionend",Yi),this.render=function(c,C){if(C!==void 0&&C.isCamera!==!0){console.error("THREE.WebGLRenderer.render: camera is not an instance of THREE.Camera.");return}if(O===!0)return;if(c.matrixWorldAutoUpdate===!0&&c.updateMatrixWorld(),C.parent===null&&C.matrixWorldAutoUpdate===!0&&C.updateMatrixWorld(),ee.enabled===!0&&ee.isPresenting===!0&&(ee.cameraAutoUpdate===!0&&ee.updateCamera(C),C=ee.getCamera()),c.isScene===!0&&c.onBeforeRender(g,c,C,G),a=Se.get(c,R.length),a.init(C),R.push(a),Z.multiplyMatrices(C.projectionMatrix,C.matrixWorldInverse),rt.setFromProjectionMatrix(Z,Ji,C.reversedDepth),z=this.localClippingEnabled,qe=te.init(this.clippingPlanes,z),d=H.get(c,U.length),d.init(),U.push(d),ee.enabled===!0&&ee.isPresenting===!0){const Q=g.xr.getDepthSensingMesh();Q!==null&&oi(Q,C,-1/0,g.sortObjects)}oi(c,C,0,g.sortObjects),d.finish(),g.sortObjects===!0&&d.sort(Ee,Ae),He=ee.enabled===!1||ee.isPresenting===!1||ee.hasDepthSensing()===!1,He&&ge.addToRenderList(d,c),this.info.render.frame++,qe===!0&&te.beginShadows();const I=a.state.shadowsArray;_e.render(I,c,C),qe===!0&&te.endShadows(),this.info.autoReset===!0&&this.info.reset();const N=d.opaque,w=d.transmissive;if(a.setupLights(),C.isArrayCamera){const Q=C.cameras;if(w.length>0)for(let se=0,ue=Q.length;se<ue;se++){const le=Q[se];$i(N,w,c,le)}He&&ge.render(c);for(let se=0,ue=Q.length;se<ue;se++){const le=Q[se];qi(d,c,le,le.viewport)}}else w.length>0&&$i(N,w,c,C),He&&ge.render(c),qi(d,c,C);G!==null&&D===0&&(Fe.updateMultisampleRenderTarget(G),Fe.updateRenderTargetMipmap(G)),c.isScene===!0&&c.onAfterRender(g,c,C),oe.resetDefaultState(),h=-1,u=null,R.pop(),R.length>0?(a=R[R.length-1],qe===!0&&te.setGlobalState(g.clippingPlanes,a.state.camera)):a=null,U.pop(),U.length>0?d=U[U.length-1]:d=null};function oi(c,C,I,N){if(c.visible===!1)return;if(c.layers.test(C.layers)){if(c.isGroup)I=c.renderOrder;else if(c.isLOD)c.autoUpdate===!0&&c.update(C);else if(c.isLight)a.pushLight(c),c.castShadow&&a.pushShadow(c);else if(c.isSprite){if(!c.frustumCulled||rt.intersectsSprite(c)){N&&De.setFromMatrixPosition(c.matrixWorld).applyMatrix4(Z);const se=L.update(c),ue=c.material;ue.visible&&d.push(c,se,ue,I,De.z,null)}}else if((c.isMesh||c.isLine||c.isPoints)&&(!c.frustumCulled||rt.intersectsObject(c))){const se=L.update(c),ue=c.material;if(N&&(c.boundingSphere!==void 0?(c.boundingSphere===null&&c.computeBoundingSphere(),De.copy(c.boundingSphere.center)):(se.boundingSphere===null&&se.computeBoundingSphere(),De.copy(se.boundingSphere.center)),De.applyMatrix4(c.matrixWorld).applyMatrix4(Z)),Array.isArray(ue)){const le=se.groups;for(let Re=0,Pe=le.length;Re<Pe;Re++){const Te=le[Re],Ge=ue[Te.materialIndex];Ge&&Ge.visible&&d.push(c,se,Ge,I,De.z,Te)}}else ue.visible&&d.push(c,se,ue,I,De.z,null)}}const Q=c.children;for(let se=0,ue=Q.length;se<ue;se++)oi(Q[se],C,I,N)}function qi(c,C,I,N){const w=c.opaque,Q=c.transmissive,se=c.transparent;a.setupLightsView(I),qe===!0&&te.setGlobalState(g.clippingPlanes,I),N&&he.viewport(A.copy(N)),w.length>0&&Vn(w,C,I),Q.length>0&&Vn(Q,C,I),se.length>0&&Vn(se,C,I),he.buffers.depth.setTest(!0),he.buffers.depth.setMask(!0),he.buffers.color.setMask(!0),he.setPolygonOffset(!1)}function $i(c,C,I,N){if((I.isScene===!0?I.overrideMaterial:null)!==null)return;a.state.transmissionRenderTarget[N.id]===void 0&&(a.state.transmissionRenderTarget[N.id]=new En(1,1,{generateMipmaps:!0,type:Ue.has("EXT_color_buffer_half_float")||Ue.has("EXT_color_buffer_float")?ni:sn,minFilter:wn,samples:4,stencilBuffer:r,resolveDepthBuffer:!1,resolveStencilBuffer:!1,colorSpace:ft.workingColorSpace}));const Q=a.state.transmissionRenderTarget[N.id],se=N.viewport||A;Q.setSize(se.z*g.transmissionResolutionScale,se.w*g.transmissionResolutionScale);const ue=g.getRenderTarget(),le=g.getActiveCubeFace(),Re=g.getActiveMipmapLevel();g.setRenderTarget(Q),g.getClearColor(K),q=g.getClearAlpha(),q<1&&g.setClearColor(16777215,.5),g.clear(),He&&ge.render(I);const Pe=g.toneMapping;g.toneMapping=Zt;const Te=N.viewport;if(N.viewport!==void 0&&(N.viewport=void 0),a.setupLightsView(N),qe===!0&&te.setGlobalState(g.clippingPlanes,N),Vn(c,I,N),Fe.updateMultisampleRenderTarget(Q),Fe.updateRenderTargetMipmap(Q),Ue.has("WEBGL_multisampled_render_to_texture")===!1){let Ge=!1;for(let Ke=0,at=C.length;Ke<at;Ke++){const je=C[Ke],$e=je.object,xe=je.geometry,nt=je.material,Ve=je.group;if(nt.side===Dt&&$e.layers.test(N.layers)){const xt=nt.side;nt.side=Rt,nt.needsUpdate=!0,Zi($e,I,N,xe,nt,Ve),nt.side=xt,nt.needsUpdate=!0,Ge=!0}}Ge===!0&&(Fe.updateMultisampleRenderTarget(Q),Fe.updateRenderTargetMipmap(Q))}g.setRenderTarget(ue,le,Re),g.setClearColor(K,q),Te!==void 0&&(N.viewport=Te),g.toneMapping=Pe}function Vn(c,C,I){const N=C.isScene===!0?C.overrideMaterial:null;for(let w=0,Q=c.length;w<Q;w++){const se=c[w],ue=se.object,le=se.geometry,Re=se.group;let Pe=se.material;Pe.allowOverride===!0&&N!==null&&(Pe=N),ue.layers.test(I.layers)&&Zi(ue,C,I,le,Pe,Re)}}function Zi(c,C,I,N,w,Q){c.onBeforeRender(g,C,I,N,w,Q),c.modelViewMatrix.multiplyMatrices(I.matrixWorldInverse,c.matrixWorld),c.normalMatrix.getNormalMatrix(c.modelViewMatrix),w.onBeforeRender(g,C,I,N,c,Q),w.transparent===!0&&w.side===Dt&&w.forceSinglePass===!1?(w.side=Rt,w.needsUpdate=!0,g.renderBufferDirect(I,C,N,w,c,Q),w.side=Un,w.needsUpdate=!0,g.renderBufferDirect(I,C,N,w,c,Q),w.side=Dt):g.renderBufferDirect(I,C,N,w,c,Q),c.onAfterRender(g,C,I,N,w,Q)}function kn(c,C,I){C.isScene!==!0&&(C=Me);const N=me.get(c),w=a.state.lights,Q=a.state.shadowsArray,se=w.state.version,ue=V.getParameters(c,w.state,Q,C,I),le=V.getProgramCacheKey(ue);let Re=N.programs;N.environment=c.isMeshStandardMaterial?C.environment:null,N.fog=C.fog,N.envMap=(c.isMeshStandardMaterial?ct:pt).get(c.envMap||N.environment),N.envMapRotation=N.environment!==null&&c.envMap===null?C.environmentRotation:c.envMapRotation,Re===void 0&&(c.addEventListener("dispose",X),Re=new Map,N.programs=Re);let Pe=Re.get(le);if(Pe!==void 0){if(N.currentProgram===Pe&&N.lightsStateVersion===se)return Qi(c,ue),Pe}else ue.uniforms=V.getUniforms(c),c.onBeforeCompile(ue,g),Pe=V.acquireProgram(ue,le),Re.set(le,Pe),N.uniforms=ue.uniforms;const Te=N.uniforms;return(!c.isShaderMaterial&&!c.isRawShaderMaterial||c.clipping===!0)&&(Te.clippingPlanes=te.uniform),Qi(c,ue),N.needsLights=$a(c),N.lightsStateVersion=se,N.needsLights&&(Te.ambientLightColor.value=w.state.ambient,Te.lightProbe.value=w.state.probe,Te.directionalLights.value=w.state.directional,Te.directionalLightShadows.value=w.state.directionalShadow,Te.spotLights.value=w.state.spot,Te.spotLightShadows.value=w.state.spotShadow,Te.rectAreaLights.value=w.state.rectArea,Te.ltc_1.value=w.state.rectAreaLTC1,Te.ltc_2.value=w.state.rectAreaLTC2,Te.pointLights.value=w.state.point,Te.pointLightShadows.value=w.state.pointShadow,Te.hemisphereLights.value=w.state.hemi,Te.directionalShadowMap.value=w.state.directionalShadowMap,Te.directionalShadowMatrix.value=w.state.directionalShadowMatrix,Te.spotShadowMap.value=w.state.spotShadowMap,Te.spotLightMatrix.value=w.state.spotLightMatrix,Te.spotLightMap.value=w.state.spotLightMap,Te.pointShadowMap.value=w.state.pointShadowMap,Te.pointShadowMatrix.value=w.state.pointShadowMatrix),N.currentProgram=Pe,N.uniformsList=null,Pe}function ji(c){if(c.uniformsList===null){const C=c.currentProgram.getUniforms();c.uniformsList=$n.seqWithValue(C.seq,c.uniforms)}return c.uniformsList}function Qi(c,C){const I=me.get(c);I.outputColorSpace=C.outputColorSpace,I.batching=C.batching,I.batchingColor=C.batchingColor,I.instancing=C.instancing,I.instancingColor=C.instancingColor,I.instancingMorph=C.instancingMorph,I.skinning=C.skinning,I.morphTargets=C.morphTargets,I.morphNormals=C.morphNormals,I.morphColors=C.morphColors,I.morphTargetsCount=C.morphTargetsCount,I.numClippingPlanes=C.numClippingPlanes,I.numIntersection=C.numClipIntersection,I.vertexAlphas=C.vertexAlphas,I.vertexTangents=C.vertexTangents,I.toneMapping=C.toneMapping}function Ya(c,C,I,N,w){C.isScene!==!0&&(C=Me),Fe.resetTextureUnits();const Q=C.fog,se=N.isMeshStandardMaterial?C.environment:null,ue=G===null?g.outputColorSpace:G.isXRRenderTarget===!0?G.texture.colorSpace:ii,le=(N.isMeshStandardMaterial?ct:pt).get(N.envMap||se),Re=N.vertexColors===!0&&!!I.attributes.color&&I.attributes.color.itemSize===4,Pe=!!I.attributes.tangent&&(!!N.normalMap||N.anisotropy>0),Te=!!I.morphAttributes.position,Ge=!!I.morphAttributes.normal,Ke=!!I.morphAttributes.color;let at=Zt;N.toneMapped&&(G===null||G.isXRRenderTarget===!0)&&(at=g.toneMapping);const je=I.morphAttributes.position||I.morphAttributes.normal||I.morphAttributes.color,$e=je!==void 0?je.length:0,xe=me.get(N),nt=a.state.lights;if(qe===!0&&(z===!0||c!==u)){const vt=c===u&&N.id===h;te.setState(N,c,vt)}let Ve=!1;N.version===xe.__version?(xe.needsLights&&xe.lightsStateVersion!==nt.state.version||xe.outputColorSpace!==ue||w.isBatchedMesh&&xe.batching===!1||!w.isBatchedMesh&&xe.batching===!0||w.isBatchedMesh&&xe.batchingColor===!0&&w.colorTexture===null||w.isBatchedMesh&&xe.batchingColor===!1&&w.colorTexture!==null||w.isInstancedMesh&&xe.instancing===!1||!w.isInstancedMesh&&xe.instancing===!0||w.isSkinnedMesh&&xe.skinning===!1||!w.isSkinnedMesh&&xe.skinning===!0||w.isInstancedMesh&&xe.instancingColor===!0&&w.instanceColor===null||w.isInstancedMesh&&xe.instancingColor===!1&&w.instanceColor!==null||w.isInstancedMesh&&xe.instancingMorph===!0&&w.morphTexture===null||w.isInstancedMesh&&xe.instancingMorph===!1&&w.morphTexture!==null||xe.envMap!==le||N.fog===!0&&xe.fog!==Q||xe.numClippingPlanes!==void 0&&(xe.numClippingPlanes!==te.numPlanes||xe.numIntersection!==te.numIntersection)||xe.vertexAlphas!==Re||xe.vertexTangents!==Pe||xe.morphTargets!==Te||xe.morphNormals!==Ge||xe.morphColors!==Ke||xe.toneMapping!==at||xe.morphTargetsCount!==$e)&&(Ve=!0):(Ve=!0,xe.__version=N.version);let xt=xe.currentProgram;Ve===!0&&(xt=kn(N,C,w));let fn=!1,At=!1,An=!1;const it=xt.getUniforms(),Ct=xe.uniforms;if(he.useProgram(xt.program)&&(fn=!0,At=!0,An=!0),N.id!==h&&(h=N.id,At=!0),fn||u!==c){he.buffers.depth.getReversed()&&c.reversedDepth!==!0&&(c._reversedDepth=!0,c.updateProjectionMatrix()),it.setValue(_,"projectionMatrix",c.projectionMatrix),it.setValue(_,"viewMatrix",c.matrixWorldInverse);const St=it.map.cameraPosition;St!==void 0&&St.setValue(_,de.setFromMatrixPosition(c.matrixWorld)),we.logarithmicDepthBuffer&&it.setValue(_,"logDepthBufFC",2/(Math.log(c.far+1)/Math.LN2)),(N.isMeshPhongMaterial||N.isMeshToonMaterial||N.isMeshLambertMaterial||N.isMeshBasicMaterial||N.isMeshStandardMaterial||N.isShaderMaterial)&&it.setValue(_,"isOrthographic",c.isOrthographicCamera===!0),u!==c&&(u=c,At=!0,An=!0)}if(w.isSkinnedMesh){it.setOptional(_,w,"bindMatrix"),it.setOptional(_,w,"bindMatrixInverse");const vt=w.skeleton;vt&&(vt.boneTexture===null&&vt.computeBoneTexture(),it.setValue(_,"boneTexture",vt.boneTexture,Fe))}w.isBatchedMesh&&(it.setOptional(_,w,"batchingTexture"),it.setValue(_,"batchingTexture",w._matricesTexture,Fe),it.setOptional(_,w,"batchingIdTexture"),it.setValue(_,"batchingIdTexture",w._indirectTexture,Fe),it.setOptional(_,w,"batchingColorTexture"),w._colorsTexture!==null&&it.setValue(_,"batchingColorTexture",w._colorsTexture,Fe));const bt=I.morphAttributes;if((bt.position!==void 0||bt.normal!==void 0||bt.color!==void 0)&&J.update(w,I,xt),(At||xe.receiveShadow!==w.receiveShadow)&&(xe.receiveShadow=w.receiveShadow,it.setValue(_,"receiveShadow",w.receiveShadow)),N.isMeshGouraudMaterial&&N.envMap!==null&&(Ct.envMap.value=le,Ct.flipEnvMap.value=le.isCubeTexture&&le.isRenderTargetTexture===!1?-1:1),N.isMeshStandardMaterial&&N.envMap===null&&C.environment!==null&&(Ct.envMapIntensity.value=C.environmentIntensity),At&&(it.setValue(_,"toneMappingExposure",g.toneMappingExposure),xe.needsLights&&qa(Ct,An),Q&&N.fog===!0&&$.refreshFogUniforms(Ct,Q),$.refreshMaterialUniforms(Ct,N,k,re,a.state.transmissionRenderTarget[c.id]),$n.upload(_,ji(xe),Ct,Fe)),N.isShaderMaterial&&N.uniformsNeedUpdate===!0&&($n.upload(_,ji(xe),Ct,Fe),N.uniformsNeedUpdate=!1),N.isSpriteMaterial&&it.setValue(_,"center",w.center),it.setValue(_,"modelViewMatrix",w.modelViewMatrix),it.setValue(_,"normalMatrix",w.normalMatrix),it.setValue(_,"modelMatrix",w.matrixWorld),N.isShaderMaterial||N.isRawShaderMaterial){const vt=N.uniformsGroups;for(let St=0,si=vt.length;St<si;St++){const Qt=vt[St];Ne.update(Qt,xt),Ne.bind(Qt,xt)}}return xt}function qa(c,C){c.ambientLightColor.needsUpdate=C,c.lightProbe.needsUpdate=C,c.directionalLights.needsUpdate=C,c.directionalLightShadows.needsUpdate=C,c.pointLights.needsUpdate=C,c.pointLightShadows.needsUpdate=C,c.spotLights.needsUpdate=C,c.spotLightShadows.needsUpdate=C,c.rectAreaLights.needsUpdate=C,c.hemisphereLights.needsUpdate=C}function $a(c){return c.isMeshLambertMaterial||c.isMeshToonMaterial||c.isMeshPhongMaterial||c.isMeshStandardMaterial||c.isShadowMaterial||c.isShaderMaterial&&c.lights===!0}this.getActiveCubeFace=function(){return P},this.getActiveMipmapLevel=function(){return D},this.getRenderTarget=function(){return G},this.setRenderTargetTextures=function(c,C,I){const N=me.get(c);N.__autoAllocateDepthBuffer=c.resolveDepthBuffer===!1,N.__autoAllocateDepthBuffer===!1&&(N.__useRenderToTexture=!1),me.get(c.texture).__webglTexture=C,me.get(c.depthTexture).__webglTexture=N.__autoAllocateDepthBuffer?void 0:I,N.__hasExternalTextures=!0},this.setRenderTargetFramebuffer=function(c,C){const I=me.get(c);I.__webglFramebuffer=C,I.__useDefaultFramebuffer=C===void 0};const Za=_.createFramebuffer();this.setRenderTarget=function(c,C=0,I=0){G=c,P=C,D=I;let N=!0,w=null,Q=!1,se=!1;if(c){const le=me.get(c);if(le.__useDefaultFramebuffer!==void 0)he.bindFramebuffer(_.FRAMEBUFFER,null),N=!1;else if(le.__webglFramebuffer===void 0)Fe.setupRenderTarget(c);else if(le.__hasExternalTextures)Fe.rebindTextures(c,me.get(c.texture).__webglTexture,me.get(c.depthTexture).__webglTexture);else if(c.depthBuffer){const Te=c.depthTexture;if(le.__boundDepthTexture!==Te){if(Te!==null&&me.has(Te)&&(c.width!==Te.image.width||c.height!==Te.image.height))throw new Error("WebGLRenderTarget: Attached DepthTexture is initialized to the incorrect size.");Fe.setupDepthRenderbuffer(c)}}const Re=c.texture;(Re.isData3DTexture||Re.isDataArrayTexture||Re.isCompressedArrayTexture)&&(se=!0);const Pe=me.get(c).__webglFramebuffer;c.isWebGLCubeRenderTarget?(Array.isArray(Pe[C])?w=Pe[C][I]:w=Pe[C],Q=!0):c.samples>0&&Fe.useMultisampledRTT(c)===!1?w=me.get(c).__webglMultisampledFramebuffer:Array.isArray(Pe)?w=Pe[I]:w=Pe,A.copy(c.viewport),F.copy(c.scissor),W=c.scissorTest}else A.copy(Oe).multiplyScalar(k).floor(),F.copy(ze).multiplyScalar(k).floor(),W=st;if(I!==0&&(w=Za),he.bindFramebuffer(_.FRAMEBUFFER,w)&&N&&he.drawBuffers(c,w),he.viewport(A),he.scissor(F),he.setScissorTest(W),Q){const le=me.get(c.texture);_.framebufferTexture2D(_.FRAMEBUFFER,_.COLOR_ATTACHMENT0,_.TEXTURE_CUBE_MAP_POSITIVE_X+C,le.__webglTexture,I)}else if(se){const le=C;for(let Re=0;Re<c.textures.length;Re++){const Pe=me.get(c.textures[Re]);_.framebufferTextureLayer(_.FRAMEBUFFER,_.COLOR_ATTACHMENT0+Re,Pe.__webglTexture,I,le)}}else if(c!==null&&I!==0){const le=me.get(c.texture);_.framebufferTexture2D(_.FRAMEBUFFER,_.COLOR_ATTACHMENT0,_.TEXTURE_2D,le.__webglTexture,I)}h=-1},this.readRenderTargetPixels=function(c,C,I,N,w,Q,se,ue=0){if(!(c&&c.isWebGLRenderTarget)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");return}let le=me.get(c).__webglFramebuffer;if(c.isWebGLCubeRenderTarget&&se!==void 0&&(le=le[se]),le){he.bindFramebuffer(_.FRAMEBUFFER,le);try{const Re=c.textures[ue],Pe=Re.format,Te=Re.type;if(!we.textureFormatReadable(Pe)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in RGBA or implementation defined format.");return}if(!we.textureTypeReadable(Te)){console.error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not in UnsignedByteType or implementation defined type.");return}C>=0&&C<=c.width-N&&I>=0&&I<=c.height-w&&(c.textures.length>1&&_.readBuffer(_.COLOR_ATTACHMENT0+ue),_.readPixels(C,I,N,w,ve.convert(Pe),ve.convert(Te),Q))}finally{const Re=G!==null?me.get(G).__webglFramebuffer:null;he.bindFramebuffer(_.FRAMEBUFFER,Re)}}},this.readRenderTargetPixelsAsync=async function(c,C,I,N,w,Q,se,ue=0){if(!(c&&c.isWebGLRenderTarget))throw new Error("THREE.WebGLRenderer.readRenderTargetPixels: renderTarget is not THREE.WebGLRenderTarget.");let le=me.get(c).__webglFramebuffer;if(c.isWebGLCubeRenderTarget&&se!==void 0&&(le=le[se]),le)if(C>=0&&C<=c.width-N&&I>=0&&I<=c.height-w){he.bindFramebuffer(_.FRAMEBUFFER,le);const Re=c.textures[ue],Pe=Re.format,Te=Re.type;if(!we.textureFormatReadable(Pe))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in RGBA or implementation defined format.");if(!we.textureTypeReadable(Te))throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: renderTarget is not in UnsignedByteType or implementation defined type.");const Ge=_.createBuffer();_.bindBuffer(_.PIXEL_PACK_BUFFER,Ge),_.bufferData(_.PIXEL_PACK_BUFFER,Q.byteLength,_.STREAM_READ),c.textures.length>1&&_.readBuffer(_.COLOR_ATTACHMENT0+ue),_.readPixels(C,I,N,w,ve.convert(Pe),ve.convert(Te),0);const Ke=G!==null?me.get(G).__webglFramebuffer:null;he.bindFramebuffer(_.FRAMEBUFFER,Ke);const at=_.fenceSync(_.SYNC_GPU_COMMANDS_COMPLETE,0);return _.flush(),await to(_,at,4),_.bindBuffer(_.PIXEL_PACK_BUFFER,Ge),_.getBufferSubData(_.PIXEL_PACK_BUFFER,0,Q),_.deleteBuffer(Ge),_.deleteSync(at),Q}else throw new Error("THREE.WebGLRenderer.readRenderTargetPixelsAsync: requested read bounds are out of range.")},this.copyFramebufferToTexture=function(c,C=null,I=0){const N=Math.pow(2,-I),w=Math.floor(c.image.width*N),Q=Math.floor(c.image.height*N),se=C!==null?C.x:0,ue=C!==null?C.y:0;Fe.setTexture2D(c,0),_.copyTexSubImage2D(_.TEXTURE_2D,I,0,0,se,ue,w,Q),he.unbindTexture()};const ja=_.createFramebuffer(),Qa=_.createFramebuffer();this.copyTextureToTexture=function(c,C,I=null,N=null,w=0,Q=null){Q===null&&(w!==0?(Mi("WebGLRenderer: copyTextureToTexture function signature has changed to support src and dst mipmap levels."),Q=w,w=0):Q=0);let se,ue,le,Re,Pe,Te,Ge,Ke,at;const je=c.isCompressedTexture?c.mipmaps[Q]:c.image;if(I!==null)se=I.max.x-I.min.x,ue=I.max.y-I.min.y,le=I.isBox3?I.max.z-I.min.z:1,Re=I.min.x,Pe=I.min.y,Te=I.isBox3?I.min.z:0;else{const bt=Math.pow(2,-w);se=Math.floor(je.width*bt),ue=Math.floor(je.height*bt),c.isDataArrayTexture?le=je.depth:c.isData3DTexture?le=Math.floor(je.depth*bt):le=1,Re=0,Pe=0,Te=0}N!==null?(Ge=N.x,Ke=N.y,at=N.z):(Ge=0,Ke=0,at=0);const $e=ve.convert(C.format),xe=ve.convert(C.type);let nt;C.isData3DTexture?(Fe.setTexture3D(C,0),nt=_.TEXTURE_3D):C.isDataArrayTexture||C.isCompressedArrayTexture?(Fe.setTexture2DArray(C,0),nt=_.TEXTURE_2D_ARRAY):(Fe.setTexture2D(C,0),nt=_.TEXTURE_2D),_.pixelStorei(_.UNPACK_FLIP_Y_WEBGL,C.flipY),_.pixelStorei(_.UNPACK_PREMULTIPLY_ALPHA_WEBGL,C.premultiplyAlpha),_.pixelStorei(_.UNPACK_ALIGNMENT,C.unpackAlignment);const Ve=_.getParameter(_.UNPACK_ROW_LENGTH),xt=_.getParameter(_.UNPACK_IMAGE_HEIGHT),fn=_.getParameter(_.UNPACK_SKIP_PIXELS),At=_.getParameter(_.UNPACK_SKIP_ROWS),An=_.getParameter(_.UNPACK_SKIP_IMAGES);_.pixelStorei(_.UNPACK_ROW_LENGTH,je.width),_.pixelStorei(_.UNPACK_IMAGE_HEIGHT,je.height),_.pixelStorei(_.UNPACK_SKIP_PIXELS,Re),_.pixelStorei(_.UNPACK_SKIP_ROWS,Pe),_.pixelStorei(_.UNPACK_SKIP_IMAGES,Te);const it=c.isDataArrayTexture||c.isData3DTexture,Ct=C.isDataArrayTexture||C.isData3DTexture;if(c.isDepthTexture){const bt=me.get(c),vt=me.get(C),St=me.get(bt.__renderTarget),si=me.get(vt.__renderTarget);he.bindFramebuffer(_.READ_FRAMEBUFFER,St.__webglFramebuffer),he.bindFramebuffer(_.DRAW_FRAMEBUFFER,si.__webglFramebuffer);for(let Qt=0;Qt<le;Qt++)it&&(_.framebufferTextureLayer(_.READ_FRAMEBUFFER,_.COLOR_ATTACHMENT0,me.get(c).__webglTexture,w,Te+Qt),_.framebufferTextureLayer(_.DRAW_FRAMEBUFFER,_.COLOR_ATTACHMENT0,me.get(C).__webglTexture,Q,at+Qt)),_.blitFramebuffer(Re,Pe,se,ue,Ge,Ke,se,ue,_.DEPTH_BUFFER_BIT,_.NEAREST);he.bindFramebuffer(_.READ_FRAMEBUFFER,null),he.bindFramebuffer(_.DRAW_FRAMEBUFFER,null)}else if(w!==0||c.isRenderTargetTexture||me.has(c)){const bt=me.get(c),vt=me.get(C);he.bindFramebuffer(_.READ_FRAMEBUFFER,ja),he.bindFramebuffer(_.DRAW_FRAMEBUFFER,Qa);for(let St=0;St<le;St++)it?_.framebufferTextureLayer(_.READ_FRAMEBUFFER,_.COLOR_ATTACHMENT0,bt.__webglTexture,w,Te+St):_.framebufferTexture2D(_.READ_FRAMEBUFFER,_.COLOR_ATTACHMENT0,_.TEXTURE_2D,bt.__webglTexture,w),Ct?_.framebufferTextureLayer(_.DRAW_FRAMEBUFFER,_.COLOR_ATTACHMENT0,vt.__webglTexture,Q,at+St):_.framebufferTexture2D(_.DRAW_FRAMEBUFFER,_.COLOR_ATTACHMENT0,_.TEXTURE_2D,vt.__webglTexture,Q),w!==0?_.blitFramebuffer(Re,Pe,se,ue,Ge,Ke,se,ue,_.COLOR_BUFFER_BIT,_.NEAREST):Ct?_.copyTexSubImage3D(nt,Q,Ge,Ke,at+St,Re,Pe,se,ue):_.copyTexSubImage2D(nt,Q,Ge,Ke,Re,Pe,se,ue);he.bindFramebuffer(_.READ_FRAMEBUFFER,null),he.bindFramebuffer(_.DRAW_FRAMEBUFFER,null)}else Ct?c.isDataTexture||c.isData3DTexture?_.texSubImage3D(nt,Q,Ge,Ke,at,se,ue,le,$e,xe,je.data):C.isCompressedArrayTexture?_.compressedTexSubImage3D(nt,Q,Ge,Ke,at,se,ue,le,$e,je.data):_.texSubImage3D(nt,Q,Ge,Ke,at,se,ue,le,$e,xe,je):c.isDataTexture?_.texSubImage2D(_.TEXTURE_2D,Q,Ge,Ke,se,ue,$e,xe,je.data):c.isCompressedTexture?_.compressedTexSubImage2D(_.TEXTURE_2D,Q,Ge,Ke,je.width,je.height,$e,je.data):_.texSubImage2D(_.TEXTURE_2D,Q,Ge,Ke,se,ue,$e,xe,je);_.pixelStorei(_.UNPACK_ROW_LENGTH,Ve),_.pixelStorei(_.UNPACK_IMAGE_HEIGHT,xt),_.pixelStorei(_.UNPACK_SKIP_PIXELS,fn),_.pixelStorei(_.UNPACK_SKIP_ROWS,At),_.pixelStorei(_.UNPACK_SKIP_IMAGES,An),Q===0&&C.generateMipmaps&&_.generateMipmap(nt),he.unbindTexture()},this.initRenderTarget=function(c){me.get(c).__webglFramebuffer===void 0&&Fe.setupRenderTarget(c)},this.initTexture=function(c){c.isCubeTexture?Fe.setTextureCube(c,0):c.isData3DTexture?Fe.setTexture3D(c,0):c.isDataArrayTexture||c.isCompressedArrayTexture?Fe.setTexture2DArray(c,0):Fe.setTexture2D(c,0),he.unbindTexture()},this.resetState=function(){P=0,D=0,G=null,he.reset(),oe.reset()},typeof __THREE_DEVTOOLS__<"u"&&__THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("observe",{detail:this}))}get coordinateSystem(){return Ji}get outputColorSpace(){return this._outputColorSpace}set outputColorSpace(n){this._outputColorSpace=n;const t=this.getContext();t.drawingBufferColorSpace=ft._getDrawingBufferColorSpace(n),t.unpackColorSpace=ft._getUnpackColorSpace()}}const tt=(e,n,t)=>Math.max(n,Math.min(t,e)),Ui=(e,n,t)=>e+(n-e)*t;function Na(e){return function(){let t=e+=1831565813;return t=Math.imul(t^t>>>15,t|1),t^=t+Math.imul(t^t>>>7,t|61),((t^t>>>14)>>>0)/4294967296}}function gn(e,n,t=17){const i=t*.731,o=Math.sin(e*.009+i)*7+Math.cos(n*.011-i)*6,r=Math.abs(Math.sin((e+n)*.021+i)*12)-4,p=Math.sin(e*.051)*Math.cos(n*.047)*2.4,f=Math.sin(n*.006+i)*74+Math.sin(n*.019)*18,x=Math.max(0,1-Math.abs(e-f)/32);return o+r+p+8-x*x*27}function Fn(e){return Number.isFinite(e)?e>=9461e9?`${(e/9461e9).toFixed(2)} ly`:e>=1e6?`${(e/1e6).toFixed(2)}m km`:e>=1e3?`${(e/1e3).toFixed(1)}k km`:e<10?`${e.toFixed(2)} km`:`${e.toFixed(1)} km`:"—"}function Eu(e){const n=(e*180/Math.PI+360)%360,t=["N","NE","E","SE","S","SW","W","NW"];return`${String(Math.round(n)).padStart(3,"0")}° ${t[Math.round(n/45)%8]}`}function Ii(e,n){const t=1-Math.pow(1-tt(n,0,1),3);return e*(1-t)}function hn(e,n){const t={...e};return n.altitude<95&&(t.orbit=!0),n.altitude<24&&(t.atmosphere=!0),n.landed&&(t.land=!0),n.mode==="foot"&&(t.eva=!0),n.returnedToShip&&!n.landed&&n.altitude>95&&(t.return=!0),t}const kt=[{id:"luma",name:"LUMA PRIME",system:"HELIX-7",distanceLy:0,map:[80,410],seed:17,className:"PELAGIC",atmosphere:"BREATHABLE",description:"An ocean world cut by luminous river deltas and lavender highlands.",sky:"#4d8fc5",ground:"#4d3f8d",accent:"#46f4e3",water:"#0dc6d2",sun:"#ffd66e"},{id:"vesper",name:"VESPER REACH",system:"VESPER-3",distanceLy:3.84,map:[410,350],seed:31,className:"TWILIGHT",atmosphere:"THIN / ARGON",description:"A permanent dusk world of copper mesas, glass plains, and long blue shadows.",sky:"#aa668d",ground:"#8c4c67",accent:"#ffab77",water:"#334b91",sun:"#ff9f68"},{id:"eir",name:"EIR SANCTUM",system:"KITE-11",distanceLy:6.21,map:[635,110],seed:49,className:"GLACIAL",atmosphere:"OXYGEN TRACE",description:"Prismatic ice shelves orbit a quiet inland sea beneath twin cyan suns.",sky:"#79b7d5",ground:"#b4d2dc",accent:"#78fff2",water:"#3876ad",sun:"#c9ffff"},{id:"morrow",name:"MORROW DEEP",system:"UMBRA-6",distanceLy:8.76,map:[690,205],seed:64,className:"SUPER-EARTH",atmosphere:"DENSE / N₂",description:"Vast indigo forests climb over warm plateaus beneath a broad silver ring.",sky:"#575a9f",ground:"#333b6d",accent:"#ff5ccf",water:"#173f71",sun:"#f7b3ff"},{id:"caelum",name:"CAELUM ARCHIVE",system:"CAELUM-2",distanceLy:12.43,map:[930,120],seed:83,className:"RELIC",atmosphere:"IONIZED",description:"Geometric ruins and floating mineral reefs surround a brilliant white star.",sky:"#6e91ba",ground:"#8b7ba6",accent:"#fff38e",water:"#428fb0",sun:"#fff9d8"},{id:"nyx",name:"NYX CASCADE",system:"NYX-14",distanceLy:9.18,map:[865,505],seed:101,className:"VOLCANIC",atmosphere:"SULFUR VEIL",description:"Black island chains rise through a warm magenta ocean threaded with lightning.",sky:"#9b5484",ground:"#493655",accent:"#ff6b9d",water:"#74377f",sun:"#ffb85d"},{id:"solace",name:"SOLACE DRIFT",system:"DRIFT-8",distanceLy:5.07,map:[510,455],seed:122,className:"TEMPERATE",atmosphere:"BREATHABLE",description:"Wind-scoured grasslands and shallow mirror lakes cover a wandering rogue world.",sky:"#5f9da2",ground:"#557d68",accent:"#8dffd3",water:"#3c8ba0",sun:"#ffe2a0"}];function Su(){console.assert(Fn(9461e9)==="1.00 ly","light-year formatting"),console.assert(Fn(182.44)==="182.4 km","kilometre formatting"),console.assert(Ii(100,0)===100&&Ii(100,1)===0,"travel endpoints"),console.assert(gn(12,34,17)===gn(12,34,17),"terrain determinism"),console.assert(kt.every(n=>n.map.length===2),"chart coordinates");let e={orbit:!1,atmosphere:!1,land:!1,eva:!1,return:!1};e=hn(e,{altitude:90,landed:!1,mode:"flight",returnedToShip:!1}),e=hn(e,{altitude:20,landed:!1,mode:"flight",returnedToShip:!1}),e=hn(e,{altitude:1.4,landed:!0,mode:"flight",returnedToShip:!1}),e=hn(e,{altitude:1.4,landed:!0,mode:"foot",returnedToShip:!1}),e=hn(e,{altitude:110,landed:!1,mode:"flight",returnedToShip:!0}),console.assert(Object.values(e).every(Boolean),"complete orbit-to-surface-to-orbit journey"),console.log("simulation self-check passed")}typeof process<"u"&&process.argv[1]?.endsWith("/sim.js")&&Su();const be=e=>document.querySelector(e),Mn=be("#viewport"),Oa=window.matchMedia("(prefers-reduced-motion: reduce)").matches,ie={app:be("#app"),intro:be("#intro"),launch:be("#launch-button"),renderer:be("#renderer-label"),targetName:be("#target-name"),targetDistance:be("#target-distance"),systemName:be("#system-name"),speed:be("#speed-value"),altitude:be("#altitude-value"),heading:be("#heading-value"),mode:be("#mode-value"),thrust:be("#thrust-bar"),thrustLabel:be("#thrust-label"),boost:be("#boost-bar"),boostLabel:be("#boost-label"),marker:be("#world-marker"),markerName:be("#marker-name"),markerDistance:be("#marker-distance"),chart:be("#chart-overlay"),chartMap:be("#chart-map"),chartClose:be("#chart-close"),chartButton:be("#chart-button"),chartDestination:be("#chart-destination"),chartDescription:be("#chart-description"),chartDistance:be("#chart-distance"),chartClass:be("#chart-class"),chartAtmosphere:be("#chart-atmosphere"),planetPreview:be("#planet-preview"),plotCourse:be("#plot-course"),targetButton:be("#target-button"),jumpButton:be("#jump-button"),gearButton:be("#gear-button"),rampButton:be("#ramp-button"),evaButton:be("#eva-button"),autopilotButton:be("#autopilot-button"),helpButton:be("#help-button"),controls:be("#controls-card"),journey:be("#journey-list"),journeyPercent:be("#journey-percent"),missionCopy:be("#mission-copy"),toast:be("#toast"),toastTitle:be("#toast-title"),toastMessage:be("#toast-message"),jumpOverlay:be("#jump-overlay"),jumpCountdown:be("#jump-countdown"),jumpDestination:be("#jump-destination")},l={started:!1,current:kt[0],selected:kt[0],target:kt[0],mode:"flight",phase:"orbital",throttle:.34,speed:8.4,boost:1,boostHeld:!1,brakeHeld:!1,verticalVelocity:0,yaw:0,pitch:-.08,roll:0,gear:0,gearTarget:0,ramp:0,rampTarget:0,landed:!1,wasLanded:!1,evaComplete:!1,returnedToShip:!1,descentAssist:!1,cameraMode:0,chartOpen:!1,jump:null,keys:new Set,stepComplete:{orbit:!1,atmosphere:!1,land:!1,eva:!1,return:!1},toastTimer:0,lastTime:performance.now(),elapsed:0},Pt=new Es;Pt.fog=new Ss(2444405,12e-5);const ht=new Dn(61,innerWidth/innerHeight,.08,5e3);ht.position.set(0,195,96);let Lt,Ni="WEBGL2";async function Mu(){if("gpu"in navigator)try{const{WebGPURenderer:e}=await Ns(async()=>{const{WebGPURenderer:t}=await import("./three.webgpu-y7v7QqYq.js");return{WebGPURenderer:t}},__vite__mapDeps([0,1]),import.meta.url),n=new e({canvas:Mn,antialias:!0,alpha:!0});return await n.init(),Ni="WEBGPU",n}catch(e){console.info("WebGPU unavailable; continuing with WebGL2.",e)}return Ni="WEBGL2",new vu({canvas:Mn,antialias:!0,alpha:!0,powerPreference:"high-performance"})}Lt=await Mu();Lt.setPixelRatio(Math.min(devicePixelRatio,1.7));Lt.setSize(innerWidth,innerHeight,!1);Lt.outputColorSpace=Oi;Lt.toneMapping=xa;Lt.toneMappingExposure=1.28;Lt.shadowMap.enabled=!0;Lt.shadowMap.type=Ta;ie.renderer.textContent=`${Ni} // ONLINE`;const Fa=new Ms(9559551,5320799,2.1);Pt.add(Fa);const zt=new Aa(16769988,4.2);zt.position.set(-180,330,-260);zt.castShadow=!0;zt.shadow.mapSize.set(1024,1024);zt.shadow.camera.left=-110;zt.shadow.camera.right=110;zt.shadow.camera.top=110;zt.shadow.camera.bottom=-110;zt.shadow.camera.far=700;Pt.add(zt);const Ba=new Aa(4516607,2.8);Ba.position.set(180,80,220);Pt.add(Ba);function Tu(){const e=document.createElement("canvas");e.width=e.height=128;const n=e.getContext("2d"),t=n.createRadialGradient(64,64,0,64,64,62);t.addColorStop(0,"rgba(255,255,255,1)"),t.addColorStop(.08,"rgba(255,255,255,.95)"),t.addColorStop(.25,"rgba(255,255,255,.28)"),t.addColorStop(1,"rgba(255,255,255,0)"),n.fillStyle=t,n.fillRect(0,0,128,128);const i=new Ts(e);return i.colorSpace=Oi,i}const xu=Tu();function Tn(e,n=1,t=1){const i=new ws(new Ps({map:xu,color:e,transparent:!0,opacity:t,blending:Ht,depthWrite:!1}));return i.scale.setScalar(n),i}function Xt(e,n,t,i=0,o=2437202){const r=new Ls;r.moveTo(e[0][0],e[0][1]);for(const[b,v]of e.slice(1))r.lineTo(b,v);r.closePath();const p=new Ds(r,{depth:n,bevelEnabled:!1,curveSegments:1});p.rotateX(Math.PI/2),p.computeVertexNormals();const f=new We(p,t);f.position.y=i+n/2,f.castShadow=!0,f.receiveShadow=!0;const x=new Pa(new ys(p,22),new wa({color:o,transparent:!0,opacity:.48}));x.position.copy(f.position);const M=new Ot;return M.add(f,x),M}function Au(){const e=new Ot;e.name="AURORA";const n=new _t({color:15195593,roughness:.54,metalness:.24,flatShading:!0}),t=new _t({color:16774623,roughness:.45,metalness:.18,flatShading:!0}),i=new _t({color:2368079,roughness:.38,metalness:.38,flatShading:!0}),o=new _t({color:4604024,roughness:.4,metalness:.3,flatShading:!0}),r=new _t({color:555896,emissive:409414,emissiveIntensity:1.6,roughness:.16,metalness:.62,flatShading:!0}),p=new _t({color:6750207,emissive:2284776,emissiveIntensity:5,roughness:.2}),f=new _t({color:16747240,emissive:16720840,emissiveIntensity:5}),x=new _t({color:1120302,metalness:.82,roughness:.24}),M=Xt([[0,-7.2],[1.35,-4.5],[2.15,-.8],[1.85,3.8],[.72,5.3],[0,4.65],[-.72,5.3],[-1.85,3.8],[-2.15,-.8],[-1.35,-4.5]],.82,n,.2);e.add(M),e.add(Xt([[0,-6.7],[.7,-4.6],[.86,1.3],[0,2.65],[-.86,1.3],[-.7,-4.6]],.34,t,1.02)),e.add(Xt([[0,-4.65],[.75,-3.5],[.82,-.65],[.52,.1],[-.52,.1],[-.82,-.65],[-.75,-3.5]],.28,r,1.42,7405554));const b=[[-1.72,-3.35],[-2.65,-2.75],[-6.5,.25],[-6.05,.92],[-2.35,-.35]],v=b.map(([D,G])=>[-D,G]),S=[[-2.05,.72],[-5.75,2.4],[-6.28,3.85],[-2.15,3.25],[-1.72,1.95]],T=S.map(([D,G])=>[-D,G]);e.add(Xt(b,.34,i,.12),Xt(v,.34,i,.12)),e.add(Xt(S,.42,o,.05),Xt(T,.42,o,.05));const B=new $t(.17,.18,4.85);for(const D of[-1,1]){const G=new We(B,t);G.position.set(D*4.2,.67,-1.25),G.rotation.y=D*.82,G.castShadow=!0,e.add(G)}const y=[[-6.38,.58,.47],[6.38,.58,.47],[-6.1,.55,3.7],[6.1,.55,3.7]];for(const[D,G,h]of y){const u=new We(new xs(.18,0),f);u.position.set(D,G,h);const A=Tn(16725714,.95,.65);A.position.copy(u.position),e.add(u,A)}const d=new Ot,a=[];for(const D of[-1,1]){const G=new We(new Ra(.7,.58,1.55,8),x);G.rotation.x=Math.PI/2,G.position.set(D*1.08,.12,4.52),G.castShadow=!0;const h=new We(new As(.48,16),p);h.position.set(D*1.08,.12,5.32);const u=new We(new Ca(.58,.11,8,20),p);u.position.copy(h.position);const A=Tn(4388607,2.2,.62);A.position.set(D*1.08,.12,5.5);const F=new We(new ba(.42,5.2,8,1,!0),new Yt({color:5435135,transparent:!0,opacity:.48,blending:Ht,depthWrite:!1}));F.rotation.x=-Math.PI/2,F.position.set(D*1.08,.12,7.8),a.push(F),d.add(G,h,u,A,F)}e.add(d);const U=Xt([[-.28,.5],[.28,.5],[.18,3.25],[-.18,3.25]],.95,i,.78);e.add(U);const R=new Ot,g=new _t({color:2503500,metalness:.72,roughness:.28});for(const[D,G]of[[-1.5,2.65],[1.5,2.65],[0,-3.8]]){const h=new We(new $t(.17,1.8,.17),g);h.position.set(D,-1.04,G);const u=new We(new $t(.72,.12,.65),g);u.position.set(D,-1.92,G+.18),R.add(h,u)}R.scale.y=.001,R.visible=!1,e.add(R);const O=new Ot;O.position.set(0,-.32,4.1);const P=new We(new $t(1.5,.12,3.4),o);return P.position.z=1.6,P.castShadow=!0,O.add(P),O.visible=!1,e.add(O),e.scale.setScalar(.7),e.userData={gear:R,rampPivot:O,trails:a,materials:{ivory:n,indigo:i,canopy:r,cyan:p}},e}const Ie=Au();Ie.position.set(0,182.4,80);Pt.add(Ie);function Ru(){const e=new Ot,n=new _t({color:15327183,roughness:.72,metalness:.12}),t=new _t({color:3420257,roughness:.45,metalness:.3}),i=new _t({color:687743,emissive:479578,emissiveIntensity:1.5,metalness:.7,roughness:.16}),o=new We(new $t(.72,.95,.4),n);o.position.y=1.2;const r=new We(new Rs(.34,12,8),i);r.scale.z=.78,r.position.set(0,1.92,-.02);const p=new We(new $t(.62,.76,.28),t);p.position.set(0,1.28,.35),e.add(o,r,p);for(const x of[-1,1]){const M=new We(new Ir(.1,.65,3,6),n);M.position.set(x*.49,1.2,0),M.rotation.z=x*-.08;const b=new We(new Ir(.13,.72,3,6),t);b.position.set(x*.21,.45,0),e.add(M,b)}const f=Tn(6488063,.55,.7);return f.position.set(.32,1.45,-.3),e.add(f),e.visible=!1,e.scale.setScalar(.7),e}const lt=Ru();Pt.add(lt);let Et=null,rn=null,qt=null,Kt=null,Zn=null,Ln=null,Nt=null;const un=430,Vt=new Le(145,0,-115);function Cu(e){e.traverse(n=>{n.geometry?.dispose(),Array.isArray(n.material)?n.material.forEach(t=>t.dispose()):n.material?.dispose()}),e.removeFromParent()}function Ga(e){Et&&Cu(Et),Et=new Ot,Et.name=`${e.name} WORLD`;const n=Na(e.seed),t=new Ye(e.ground),i=new Ye(e.water),o=new Ye(e.accent),r=new hi(un,5),p=[],f=r.attributes.position;for(let u=0;u<f.count;u+=1){const A=new Le().fromBufferAttribute(f,u).normalize(),F=Math.sin(A.x*18+e.seed)+Math.cos(A.z*25-e.seed*.3)+Math.sin(A.y*31),W=F>.45?t.clone().lerp(o,tt((F-.4)*.18,0,.28)):i.clone().multiplyScalar(.73+Math.max(0,A.y)*.3);p.push(W.r,W.g,W.b)}r.setAttribute("color",new Di(p,3));const x=new _t({vertexColors:!0,roughness:.79,metalness:.08,flatShading:!0});Kt=new We(r,x),Kt.position.y=-un,Kt.receiveShadow=!0,Et.add(Kt);const M=new Yt({color:e.sky,transparent:!0,opacity:.2,side:Rt,depthWrite:!1,blending:Ht});Zn=new We(new hi(un+12,5),M),Zn.position.copy(Kt.position),Et.add(Zn);const b=new We(new Ca(un+5,3.2,8,160),new Yt({color:e.accent,transparent:!0,opacity:.45,blending:Ht,depthWrite:!1}));if(b.rotation.x=Math.PI/2,b.position.copy(Kt.position),Et.add(b),e.seed%2===1){const u=new We(new Nr(un*1.15,un*1.42,128),new Yt({color:e.accent,transparent:!0,opacity:.14,side:Dt,depthWrite:!1}));u.rotation.x=Math.PI/2,u.position.copy(Kt.position),Et.add(u)}const v=new ti(1350,1350,108,108),S=v.attributes.position,T=[];for(let u=0;u<S.count;u+=1){const A=S.getX(u),F=-S.getY(u),W=gn(A,F,e.seed);S.setZ(u,W);const K=tt((W-1.2)/28,0,1),q=W<1.2?i.clone().multiplyScalar(.52):t.clone().lerp(o,K*.2).offsetHSL((n()-.5)*.025,0,(n()-.5)*.06);T.push(q.r,q.g,q.b)}v.setAttribute("color",new Di(T,3)),v.computeVertexNormals(),v.rotateX(-Math.PI/2);const B=new _t({vertexColors:!0,roughness:.91,metalness:.03,flatShading:!0,transparent:!0,opacity:0});rn=new We(v,B),rn.receiveShadow=!0,rn.castShadow=!0,rn.visible=!1,Et.add(rn);const y=new ti(1350,1350,1,1),d=new _t({color:e.water,emissive:e.water,emissiveIntensity:.35,roughness:.18,metalness:.32,transparent:!0,opacity:0,depthWrite:!1});qt=new We(y,d),qt.rotation.x=-Math.PI/2,qt.position.y=1.2,qt.visible=!1,Et.add(qt),Ln=new Ot;const a=new ba(.6,4,5),U=new _t({color:e.ground,emissive:e.accent,emissiveIntensity:.12,roughness:.68,flatShading:!0}),R=new Cs(a,U,180),g=new vn;for(let u=0;u<180;u+=1){const A=(n()-.5)*1050,F=(n()-.5)*1050,W=gn(A,F,e.seed),K=.6+n()*3.2;g.compose(new Le(A,W+K*1.9,F),new bs().setFromEuler(new Gi(0,n()*Math.PI,(n()-.5)*.17)),new Le(K,K,K)),R.setMatrixAt(u,g)}R.castShadow=!0,R.receiveShadow=!0,Ln.add(R),Ln.visible=!1,Et.add(Ln),Vt.y=gn(Vt.x,Vt.z,e.seed),Nt=new Ot;const O=new We(new Nr(5.2,5.55,48),new Yt({color:e.accent,transparent:!0,opacity:.7,side:Dt,blending:Ht}));O.rotation.x=-Math.PI/2;const P=new We(new Ra(.06,.35,10,8,1,!0),new Yt({color:e.accent,transparent:!0,opacity:.32,blending:Ht,depthWrite:!1}));P.position.y=5;const D=Tn(e.accent,5,.45);D.position.y=10,Nt.position.copy(Vt),Nt.position.y+=.25,Nt.add(O,P,D),Nt.visible=!1,Et.add(Nt);const G=Tn(e.sun,95,.8);G.position.set(-390,420,-800),Et.add(G);const h=new We(new hi(13,2),new Yt({color:e.sun}));h.position.copy(G.position),Et.add(h),Pt.add(Et),document.documentElement.style.setProperty("--planet",e.ground),ie.systemName.textContent=`${e.system} SYSTEM`}Ga(l.current);Pt.add(ht);const Vi=new Ot,bu=[[-.72,.41,-.56],[-.35,.66,-.73],[.08,.48,-.88],[.48,.7,-.48],[.76,.2,-.61],[.58,-.18,-.79],[-.61,-.08,-.78]],ki=new Map;kt.forEach((e,n)=>{const t=Tn(e.sun,n===0?10:7+n%3*1.2,.92),i=new Le(...bu[n]).normalize();t.position.copy(i.multiplyScalar(720)),t.userData.destination=e,Vi.add(t),ki.set(e.id,t)});Pt.add(Vi);function wu(){const e=Na(7321),n=[];for(let r=0;r<240;r+=1){const p=e()*Math.PI*2,f=5+e()*92,x=-20-e()*470,M=Math.cos(p)*f,b=Math.sin(p)*f;n.push(M,b,x,M,b,x+1.4+e()*4)}const t=new Bi;t.setAttribute("position",new Di(n,3));const i=new wa({color:9304575,transparent:!0,opacity:0,blending:Ht,depthWrite:!1,depthTest:!1}),o=new Pa(t,i);return o.frustumCulled=!1,ht.add(o),o}const Cn=wu();function Pu(){kt.forEach(e=>{const n=document.createElement("button");n.className="star-node",n.type="button",n.dataset.id=e.id,n.style.setProperty("--x",`${e.map[0]/10}%`),n.style.setProperty("--y",`${e.map[1]/6}%`),n.style.setProperty("--star",e.sun),n.innerHTML=`<span>${e.name}<small>${e.system}</small></span>`,n.addEventListener("click",()=>Bn(e)),ie.chartMap.append(n)}),Bn(l.selected)}function Bn(e){l.selected=e,document.querySelectorAll(".star-node").forEach(n=>{n.classList.toggle("selected",n.dataset.id===e.id),n.classList.toggle("current",n.dataset.id===l.current.id)}),ie.chartDestination.textContent=e.name,ie.chartDescription.textContent=e.description,ie.chartDistance.textContent=e.id===l.current.id?"LOCAL ORBIT":`${e.distanceLy.toFixed(2)} LIGHT YEARS`,ie.chartClass.textContent=e.className,ie.chartAtmosphere.textContent=e.atmosphere,ie.planetPreview.style.setProperty("--planet",e.ground),ie.plotCourse.textContent=e.id===l.target.id?"WAYPOINT ACTIVE  ✓":"SET AS WAYPOINT  →"}Pu();function Wi(){!l.started||l.jump||(l.chartOpen=!0,ie.chart.classList.add("open"),ie.chart.setAttribute("aria-hidden","false"),Bn(l.target))}function Gn(){l.chartOpen=!1,ie.chart.classList.remove("open"),ie.chart.setAttribute("aria-hidden","true")}function Hn(e,n=!0){l.target=e,l.selected=e,ie.targetName.textContent=e.id===l.current.id?`${e.name} // DELTA`:e.name,ie.jumpButton.disabled=e.id===l.current.id,Bn(e),n&&ot("WAYPOINT LOCKED",e.id===l.current.id?"River Delta approach plotted":`${e.name} synchronized`)}function Ha(){const e=kt.findIndex(n=>n.id===l.target.id);Hn(kt[(e+1)%kt.length])}function ot(e,n){ie.toastTitle.textContent=e,ie.toastMessage.textContent=n,ie.toast.classList.add("show"),clearTimeout(l.toastTimer),l.toastTimer=setTimeout(()=>ie.toast.classList.remove("show"),2800)}function ln(e=Ie.position.x,n=Ie.position.z){return gn(e,n,l.current.seed)}function Wt(){return Math.max(0,Ie.position.y-ln())}function Va(){if(l.mode==="flight"){if(!l.landed&&Wt()>18){ot("GEAR INTERLOCK","Descend below 18 km to deploy");return}if(l.gearTarget=l.gearTarget>.5?0:1,!l.gearTarget&&l.landed){l.gearTarget=1,ot("GEAR LOCKED","Landing load detected");return}ot("LANDING GEAR",l.gearTarget?"Deployment initiated":"Retracting")}}function ka(){if(!l.landed||l.gear<.8||l.mode!=="flight"){ot("RAMP INTERLOCK","Land with gear deployed first");return}l.rampTarget=l.rampTarget>.5?0:1,ot("AFT RAMP",l.rampTarget?"Opening for surface egress":"Securing cabin")}function Lu(){const e=new Le(0,0,6.4).applyAxisAngle(new Le(0,1,0),l.yaw),n=Ie.position.clone().add(e);return n.y=ln(n.x,n.z),n}function Wa(){if(l.mode==="flight"){if(!l.landed||l.ramp<.8||l.gear<.8){ot("EVA INTERLOCK","Land and lower the ramp to disembark");return}l.mode="foot",lt.position.copy(Lu()),lt.visible=!0,l.walkYaw=l.yaw,l.evaComplete=!0,l.stepComplete.eva=!0,ot("FIRST FOOTFALL",`${l.current.name} surface contact confirmed`);return}const e=new gt(lt.position.x-Ie.position.x,lt.position.z-Ie.position.z).length();if(e>10){ot("AURORA",`${e.toFixed(1)} km — move closer to the ramp`);return}l.mode="flight",lt.visible=!1,l.returnedToShip=!0,ot("CABIN SECURE","Pilot link restored — close ramp and launch")}function Du(){return!l.landed||l.mode!=="flight"?!1:l.ramp>.15?(ot("LAUNCH INTERLOCK","Close the aft ramp before lift-off"),!0):(l.landed=!1,l.verticalVelocity=7.5,l.throttle=Math.max(.48,l.throttle),l.gearTarget=0,l.descentAssist=!1,ot("LIFT-OFF","AURORA is airborne"),!0)}function zi(){if(!(l.mode!=="flight"||l.jump)){if(l.landed){ot("DESCENT ASSIST","Already on the surface");return}l.target.id!==l.current.id&&Hn(l.current,!1),l.descentAssist=!l.descentAssist,ie.autopilotButton.classList.toggle("active",l.descentAssist),ot("DESCENT ASSIST",l.descentAssist?"River Delta landing solution engaged":"Manual flight restored")}}function Xi(){if(l.jump||l.mode!=="flight")return;if(l.target.id===l.current.id){ot("PULSE DRIVE","Select another star in the chart");return}if(Wt()<85){ot("PULSE DRIVE LOCKED","Climb above 85 km before interstellar travel");return}const e=l.target.distanceLy*9461e9;l.jump={elapsed:0,duration:Oa?1.8:4.8,initialKm:e},l.descentAssist=!1,ie.autopilotButton.classList.remove("active"),ie.jumpDestination.textContent=l.target.name,ie.jumpOverlay.classList.add("active"),ie.jumpOverlay.setAttribute("aria-hidden","false"),ot("PULSE DRIVE","Space-time corridor acquired")}function yu(){const e=l.target;l.current=e,Ga(e),Ie.position.set(0,182.4,80),l.yaw=0,l.pitch=-.08,l.roll=0,l.speed=8.4,l.throttle=.34,l.verticalVelocity=0,l.gear=l.gearTarget=0,l.ramp=l.rampTarget=0,l.landed=!1,l.jump=null,ie.jumpOverlay.classList.remove("active"),ie.jumpOverlay.setAttribute("aria-hidden","true"),Hn(e,!1),Bn(e),ot("SYSTEM ARRIVAL",`${e.system} orbit established`)}function Uu(){const e=Wt();l.stepComplete=hn(l.stepComplete,{altitude:e,landed:l.landed,mode:l.mode,returnedToShip:l.returnedToShip});const n=["orbit","atmosphere","land","eva","return"],t=n.filter(o=>l.stepComplete[o]).length,i=n.find(o=>!l.stepComplete[o]);ie.journeyPercent.textContent=`${Math.round(14+t*17.2)}%`,ie.journey.querySelectorAll("li").forEach(o=>{const r=o.dataset.step;o.classList.toggle("complete",l.stepComplete[r]),o.classList.toggle("active",r===i)}),l.stepComplete.return?ie.missionCopy.textContent="Journey complete. The next charted light is waiting.":l.mode==="foot"?ie.missionCopy.textContent="Explore the river delta, then return to AURORA through the aft ramp.":l.landed?ie.missionCopy.textContent="Lower the aft ramp and step onto the generated terrain.":e<24?ie.missionCopy.textContent="Bleed speed, deploy landing gear, and follow the delta beacon.":e<95&&(ie.missionCopy.textContent="Atmosphere acquired. Hold the descent corridor.")}function Iu(){ie.controls.classList.toggle("open")}ie.launch.addEventListener("click",()=>{l.started=!0,ie.app.classList.add("started"),ie.intro.classList.add("dismissed"),setTimeout(()=>ot("FLIGHT LINK","AURORA controls online — press P for descent assist"),500)});ie.chartButton.addEventListener("click",Wi);be("#target-chip").addEventListener("click",Wi);ie.chartClose.addEventListener("click",Gn);ie.chart.querySelector(".chart-backdrop").addEventListener("click",Gn);ie.plotCourse.addEventListener("click",()=>{Hn(l.selected),Gn()});ie.targetButton.addEventListener("click",Ha);ie.jumpButton.addEventListener("click",Xi);ie.gearButton.addEventListener("click",Va);ie.rampButton.addEventListener("click",ka);ie.evaButton.addEventListener("click",Wa);ie.autopilotButton.addEventListener("click",zi);ie.helpButton.addEventListener("click",Iu);ie.marker.addEventListener("click",()=>l.target.id===l.current.id?zi():Xi());window.addEventListener("keydown",e=>{if(["Space","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.code)&&e.preventDefault(),l.keys.add(e.code),!e.repeat){if(e.code==="Escape"&&l.chartOpen)return Gn();if(e.code==="KeyM")return l.chartOpen?Gn():Wi();l.chartOpen||!l.started||(e.code==="KeyT"&&Ha(),e.code==="KeyJ"&&Xi(),e.code==="KeyG"&&Va(),e.code==="KeyR"&&ka(),e.code==="KeyF"&&Wa(),e.code==="KeyP"&&zi(),e.code==="KeyV"&&(l.cameraMode=(l.cameraMode+1)%2,ot("CAMERA",l.cameraMode?"Close chase view":"Wide chase view")),e.code==="Space"&&l.landed&&Du())}});window.addEventListener("keyup",e=>l.keys.delete(e.code));window.addEventListener("blur",()=>l.keys.clear());window.addEventListener("wheel",e=>{!l.started||l.chartOpen||l.mode!=="flight"||(l.throttle=tt(l.throttle-Math.sign(e.deltaY)*.06,0,1))},{passive:!0});let Ki=!1,jn={x:0,y:0};Mn.addEventListener("pointerdown",e=>{!l.started||l.chartOpen||(Ki=!0,jn={x:e.clientX,y:e.clientY},Mn.setPointerCapture(e.pointerId))});Mn.addEventListener("pointermove",e=>{if(!Ki||l.mode!=="flight"||l.descentAssist)return;const n=e.clientX-jn.x,t=e.clientY-jn.y;l.yaw-=n*.0025,l.pitch=tt(l.pitch-t*.002,-.48,.48),jn={x:e.clientX,y:e.clientY}});Mn.addEventListener("pointerup",()=>{Ki=!1});window.addEventListener("resize",()=>{ht.aspect=innerWidth/innerHeight,ht.updateProjectionMatrix(),Lt.setSize(innerWidth,innerHeight,!1),Lt.setPixelRatio(Math.min(devicePixelRatio,1.7))});new Le(0,1,0);const za=new Le(0,0,-1),wt=new Le,Nu=new Le,bn=new Le;function sa(e,n){return Math.atan2(Math.sin(n-e),Math.cos(n-e))}function yt(e,n,t,i){return Ui(e,n,1-Math.exp(-t*i))}function Xa(){const e=ln();Ie.position.y=e+1.42,l.landed=!0,l.wasLanded=!0,l.speed=0,l.verticalVelocity=0,l.throttle=0,l.pitch=0,l.roll=0,l.gearTarget=1,l.descentAssist=!1,ie.autopilotButton.classList.remove("active"),l.stepComplete.land=!0,ot("TOUCHDOWN",`${l.current.name} // River Delta`)}function Ou(e){wt.set(Vt.x-Ie.position.x,0,Vt.z-Ie.position.z);const n=wt.length();n>.001&&wt.normalize();const t=Math.atan2(-wt.x,-wt.z);l.yaw+=sa(l.yaw,t)*Math.min(1,e*1.8);const i=tt(n*.14,2.2,Wt()>70?31:18);l.speed=yt(l.speed,i,2.2,e);const o=Math.min(n,l.speed*e);Ie.position.x+=wt.x*o,Ie.position.z+=wt.z*o;const r=ln(),p=1.42+tt(n*.42,0,145),f=Ie.position.y-r,x=tt(Math.abs(f-p)*.36,.35,15);Ie.position.y+=Math.sign(p-f)*Math.min(Math.abs(p-f),x*e),l.pitch=yt(l.pitch,tt((p-f)*.012,-.24,.12),2.1,e),l.roll=yt(l.roll,sa(l.yaw,t)*-.6,2.2,e),l.throttle=tt(l.speed/31,.12,.74),Wt()<16&&(l.gearTarget=1),n<1.7&&Wt()<1.7&&l.gear>.78&&Xa()}function Fu(e){const n=(l.keys.has("KeyA")||l.keys.has("ArrowLeft")?1:0)-(l.keys.has("KeyD")||l.keys.has("ArrowRight")?1:0),t=(l.keys.has("ArrowUp")?1:0)-(l.keys.has("ArrowDown")?1:0),i=(l.keys.has("KeyQ")?1:0)-(l.keys.has("KeyE")?1:0);l.keys.has("KeyW")&&(l.throttle=tt(l.throttle+e*.28,0,1)),l.keys.has("KeyS")&&(l.throttle=tt(l.throttle-e*.32,0,1)),l.yaw+=n*e*(.62+l.speed*.006),l.pitch=tt(l.pitch+t*e*.48,-.52,.52);const o=i*.5+n*.25;l.roll=yt(l.roll,o,3.2,e),l.boostHeld=(l.keys.has("ShiftLeft")||l.keys.has("ShiftRight"))&&l.boost>.015,l.brakeHeld=l.keys.has("KeyX"),l.boostHeld?l.boost=tt(l.boost-e*.115,0,1):l.boost=tt(l.boost+e*.055,0,1);const r=tt(1-Wt()/120,0,1);let p=3+l.throttle*(29-r*8);l.boostHeld&&(p+=58),l.brakeHeld&&(p=Math.min(p,3.2)),l.speed=yt(l.speed,p,l.brakeHeld?4.7:1.7,e),Ie.rotation.order="YXZ",Ie.rotation.set(l.pitch,l.yaw,l.roll);const f=za.clone().applyQuaternion(Ie.quaternion).normalize();Ie.position.x+=f.x*l.speed*e,Ie.position.z+=f.z*l.speed*e;const x=(l.keys.has("Space")?1:0)-(l.keys.has("KeyC")?1:0);l.verticalVelocity+=x*e*(8.5+r*5),l.verticalVelocity-=r*e*.42,l.verticalVelocity*=Math.exp(-e*(1.3+r*.5)),Ie.position.y+=(f.y*l.speed*.63+l.verticalVelocity)*e,Ie.position.x=tt(Ie.position.x,-610,610),Ie.position.z=tt(Ie.position.z,-610,610),Ie.position.y-ln()<1.3&&(l.gear>.72&&l.speed<14&&Math.abs(l.verticalVelocity)<5?Xa():(Ie.position.y=ln()+2.1,l.verticalVelocity=Math.max(3,-l.verticalVelocity*.25),l.speed*=.52,ot("PROXIMITY ALERT",l.gear<.72?"Deploy landing gear before contact":"Reduce approach speed")))}function Bu(e){l.mode!=="flight"||l.landed||(l.descentAssist?Ou(e):Fu(e),Ie.rotation.order="YXZ",Ie.rotation.set(l.pitch,l.yaw,l.roll))}function Gu(e){if(l.mode!=="foot")return;const n=(l.keys.has("KeyA")||l.keys.has("ArrowLeft")?1:0)-(l.keys.has("KeyD")||l.keys.has("ArrowRight")?1:0),t=(l.keys.has("KeyW")||l.keys.has("ArrowUp")?1:0)-(l.keys.has("KeyS")||l.keys.has("ArrowDown")?1:0);l.walkYaw+=n*e*1.65;const i=l.keys.has("ShiftLeft")||l.keys.has("ShiftRight")?7:3.8;lt.position.x-=Math.sin(l.walkYaw)*t*i*e,lt.position.z-=Math.cos(l.walkYaw)*t*i*e,lt.position.x=tt(lt.position.x,-610,610),lt.position.z=tt(lt.position.z,-610,610),lt.position.y=ln(lt.position.x,lt.position.z)+Math.abs(Math.sin(l.elapsed*8))*Math.abs(t)*.06,lt.rotation.y=l.walkYaw}function Hu(e){l.gear=yt(l.gear,l.gearTarget,4,e),l.ramp=yt(l.ramp,l.rampTarget,3,e);const n=Ie.userData.gear;n.visible=l.gear>.015,n.scale.y=Math.max(.001,l.gear);const t=Ie.userData.rampPivot;t.visible=l.ramp>.015,t.rotation.x=l.ramp*-.62}function Vu(e){const n=Wt(),t=tt((125-n)/116,0,1),i=tt((128-n)/62,0,1);document.documentElement.style.setProperty("--atmo",t.toFixed(3)),Pt.fog.color.set(l.current.sky).lerp(new Ye(2311273),1-t),Pt.fog.density=Ui(12e-5,.0041,t*t),Fa.intensity=Ui(2.1,3.15,t),rn.visible=i>.01,rn.material.opacity=i,qt.visible=i>.02,qt.material.opacity=i*.68,qt.position.y=1.2+Math.sin(l.elapsed*.62)*.06,Ln.visible=n<62,Nt.visible=n<145&&!l.landed,Nt.visible&&(Nt.rotation.y+=e*.38,Nt.children[1].material.opacity=.22+Math.sin(l.elapsed*2.5)*.08),Zn.material.opacity=.13+t*.12,Kt.rotation.y+=n>130?e*.002:0,Vi.position.copy(ht.position),ki.forEach((o,r)=>{o.visible=n>22&&r!==l.current.id,o.material.opacity=tt((n-18)/55,.08,.92)})}function ku(e){const n=l.jump?1:0,t=l.boostHeld?.64:0;Cn.material.opacity=yt(Cn.material.opacity,n*.78+t*.3,5,e),Cn.scale.z=yt(Cn.scale.z,l.jump?13:l.boostHeld?4.5:1,4,e);const i=Cn.geometry.attributes.position,o=e*(l.jump?420:l.boostHeld?95:10);for(let p=0;p<i.count;p+=2){let f=i.getZ(p)+o;const x=i.getZ(p+1)-i.getZ(p);f>10&&(f=-490),i.setZ(p,f),i.setZ(p+1,f+x)}i.needsUpdate=!0,Ie.userData.trails.forEach(p=>{p.scale.y=yt(p.scale.y,l.jump?3.5:l.boostHeld?2.4:.75+l.throttle*.55,6,e),p.material.opacity=l.mode==="foot"||l.landed?.06:.25+l.throttle*.25+t*.45});const r=l.jump?84:l.boostHeld?71:l.cameraMode?67:61;ht.fov=yt(ht.fov,r,4,e),ht.updateProjectionMatrix()}function Wu(e){if(l.jump){const i=Oa?0:.08+Math.sin(l.elapsed*29)*.06;ht.position.x+=i;return}if(l.mode==="foot"){const i=new Le(Math.sin(l.walkYaw),0,Math.cos(l.walkYaw));wt.copy(lt.position).addScaledVector(i,5.3).add(new Le(0,2.8,0)),ht.position.lerp(wt,1-Math.exp(-e*5)),bn.copy(lt.position).add(new Le(0,1.25,0)).addScaledVector(i,-5),ht.lookAt(bn);return}const n=l.cameraMode?new Le(0,2.45,8.7):new Le(0,5.2,15.2);n.applyQuaternion(Ie.quaternion),wt.copy(Ie.position).add(n),ht.position.lerp(wt,1-Math.exp(-e*(l.cameraMode?5.5:3.3)));const t=za.clone().applyQuaternion(Ie.quaternion);bn.copy(Ie.position).addScaledVector(t,l.cameraMode?18:11),bn.y-=l.cameraMode?.2:2.15,ht.lookAt(bn)}function zu(){if(l.mode==="foot"){ie.markerName.textContent="AURORA";const n=new gt(lt.position.x-Ie.position.x,lt.position.z-Ie.position.z).length();return ie.markerDistance.textContent=Fn(n),Ie.position.clone().add(new Le(0,3.5,0))}if(l.target.id===l.current.id){const n=Ie.position.distanceTo(Vt);return ie.markerName.textContent="RIVER DELTA",ie.markerDistance.textContent=Fn(n),Vt.clone().add(new Le(0,9,0))}const e=ki.get(l.target.id);return ie.markerName.textContent=l.target.name,ie.markerDistance.textContent=`${l.target.distanceLy.toFixed(2)} ly`,e.getWorldPosition(new Le)}function Xu(){const e=zu(),n=ht.getWorldDirection(Nu),t=wt.copy(e).sub(ht.position),i=n.dot(t.normalize())>.05;e.project(ht);const o=i&&Math.abs(e.x)<.93&&Math.abs(e.y)<.84;ie.marker.style.visibility=o?"visible":"hidden",o&&(ie.marker.style.left=`${(e.x*.5+.5)*innerWidth}px`,ie.marker.style.top=`${(-e.y*.5+.5)*innerHeight}px`)}function Ka(){const e=Wt();let n;l.jump?n=Ii(l.jump.initialKm,l.jump.elapsed/l.jump.duration):l.target.id===l.current.id?n=Ie.position.distanceTo(Vt):n=l.target.distanceLy*9461e9,ie.targetDistance.textContent=Fn(n),ie.speed.textContent=(l.speed*.05).toFixed(2),ie.altitude.textContent=e<10?e.toFixed(2):e.toFixed(1),ie.heading.textContent=Eu(-l.yaw),l.phase=l.mode==="foot"?"surface eva":l.landed?"landed":e>95?"orbital":e>12?"atmospheric":"terrain flight",ie.mode.textContent=l.phase.toUpperCase(),ie.thrust.style.width=`${l.throttle*100}%`,ie.thrustLabel.textContent=`${Math.round(l.throttle*100)}%`,ie.boost.style.width=`${l.boost*100}%`,ie.boostLabel.textContent=`${Math.round(l.boost*100)}%`,ie.gearButton.classList.toggle("active",l.gearTarget>.5),ie.rampButton.classList.toggle("active",l.rampTarget>.5),ie.evaButton.classList.toggle("active",l.mode==="foot"),ie.evaButton.querySelector("span").textContent=l.mode==="foot"?"BOARD SHIP":"DISEMBARK",ie.jumpButton.disabled=l.target.id===l.current.id||l.mode==="foot"||!!l.jump,Xu(),Uu()}function Ku(e){if(!l.jump)return!1;l.jump.elapsed+=e;const n=tt(l.jump.elapsed/l.jump.duration,0,1);return n<.18?ie.jumpCountdown.textContent=`CHARGING ${Math.round(n/.18*100)}%`:n<.86?ie.jumpCountdown.textContent=`TRANSIT ${Math.round(n*100)}%`:ie.jumpCountdown.textContent="REALSPACE LOCK",n>=1&&yu(),!0}function Yu(e){const n=Math.min(.05,Math.max(.001,(e-l.lastTime)/1e3));l.lastTime=e,l.elapsed+=n;const t=Ku(n);l.started&&!l.chartOpen&&!t&&(Bu(n),Gu(n)),Hu(n),Wu(n),Vu(n),ku(n),Ka(),Lt.render(Pt,ht)}Hn(l.current,!1);Ka();Lt.setAnimationLoop(Yu);
//# sourceMappingURL=index-wlEQR6wm.js.map
