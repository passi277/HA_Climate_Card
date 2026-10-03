function t(t,e,i,s){var n,o=arguments.length,r=o<3?e:null===s?s=Object.getOwnPropertyDescriptor(e,i):s;if("object"==typeof Reflect&&"function"==typeof Reflect.decorate)r=Reflect.decorate(t,e,i,s);else for(var a=t.length-1;a>=0;a--)(n=t[a])&&(r=(o<3?n(r):o>3?n(e,i,r):n(e,i))||r);return o>3&&r&&Object.defineProperty(e,i,r),r}"function"==typeof SuppressedError&&SuppressedError;const e=globalThis,i=e.ShadowRoot&&(void 0===e.ShadyCSS||e.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,s=Symbol(),n=new WeakMap;let o=class{constructor(t,e,i){if(this._$cssResult$=!0,i!==s)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=t,this.t=e}get styleSheet(){let t=this.o;const e=this.t;if(i&&void 0===t){const i=void 0!==e&&1===e.length;i&&(t=n.get(e)),void 0===t&&((this.o=t=new CSSStyleSheet).replaceSync(this.cssText),i&&n.set(e,t))}return t}toString(){return this.cssText}};const r=(t,...e)=>{const i=1===t.length?t[0]:e.reduce((e,i,s)=>e+(t=>{if(!0===t._$cssResult$)return t.cssText;if("number"==typeof t)return t;throw Error("Value passed to 'css' function must be a 'css' function result: "+t+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(i)+t[s+1],t[0]);return new o(i,t,s)},a=i?t=>t:t=>t instanceof CSSStyleSheet?(t=>{let e="";for(const i of t.cssRules)e+=i.cssText;return(t=>new o("string"==typeof t?t:t+"",void 0,s))(e)})(t):t,{is:c,defineProperty:l,getOwnPropertyDescriptor:h,getOwnPropertyNames:d,getOwnPropertySymbols:p,getPrototypeOf:u}=Object,m=globalThis,_=m.trustedTypes,f=_?_.emptyScript:"",g=m.reactiveElementPolyfillSupport,b=(t,e)=>t,y={toAttribute(t,e){switch(e){case Boolean:t=t?f:null;break;case Object:case Array:t=null==t?t:JSON.stringify(t)}return t},fromAttribute(t,e){let i=t;switch(e){case Boolean:i=null!==t;break;case Number:i=null===t?null:Number(t);break;case Object:case Array:try{i=JSON.parse(t)}catch(t){i=null}}return i}},v=(t,e)=>!c(t,e),w={attribute:!0,type:String,converter:y,reflect:!1,useDefault:!1,hasChanged:v};Symbol.metadata??=Symbol("metadata"),m.litPropertyMetadata??=new WeakMap;let x=class extends HTMLElement{static addInitializer(t){this._$Ei(),(this.l??=[]).push(t)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(t,e=w){if(e.state&&(e.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(t)&&((e=Object.create(e)).wrapped=!0),this.elementProperties.set(t,e),!e.noAccessor){const i=Symbol(),s=this.getPropertyDescriptor(t,i,e);void 0!==s&&l(this.prototype,t,s)}}static getPropertyDescriptor(t,e,i){const{get:s,set:n}=h(this.prototype,t)??{get(){return this[e]},set(t){this[e]=t}};return{get:s,set(e){const o=s?.call(this);n?.call(this,e),this.requestUpdate(t,o,i)},configurable:!0,enumerable:!0}}static getPropertyOptions(t){return this.elementProperties.get(t)??w}static _$Ei(){if(this.hasOwnProperty(b("elementProperties")))return;const t=u(this);t.finalize(),void 0!==t.l&&(this.l=[...t.l]),this.elementProperties=new Map(t.elementProperties)}static finalize(){if(this.hasOwnProperty(b("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(b("properties"))){const t=this.properties,e=[...d(t),...p(t)];for(const i of e)this.createProperty(i,t[i])}const t=this[Symbol.metadata];if(null!==t){const e=litPropertyMetadata.get(t);if(void 0!==e)for(const[t,i]of e)this.elementProperties.set(t,i)}this._$Eh=new Map;for(const[t,e]of this.elementProperties){const i=this._$Eu(t,e);void 0!==i&&this._$Eh.set(i,t)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(t){const e=[];if(Array.isArray(t)){const i=new Set(t.flat(1/0).reverse());for(const t of i)e.unshift(a(t))}else void 0!==t&&e.push(a(t));return e}static _$Eu(t,e){const i=e.attribute;return!1===i?void 0:"string"==typeof i?i:"string"==typeof t?t.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){this._$ES=new Promise(t=>this.enableUpdating=t),this._$AL=new Map,this._$E_(),this.requestUpdate(),this.constructor.l?.forEach(t=>t(this))}addController(t){(this._$EO??=new Set).add(t),void 0!==this.renderRoot&&this.isConnected&&t.hostConnected?.()}removeController(t){this._$EO?.delete(t)}_$E_(){const t=new Map,e=this.constructor.elementProperties;for(const i of e.keys())this.hasOwnProperty(i)&&(t.set(i,this[i]),delete this[i]);t.size>0&&(this._$Ep=t)}createRenderRoot(){const t=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return((t,s)=>{if(i)t.adoptedStyleSheets=s.map(t=>t instanceof CSSStyleSheet?t:t.styleSheet);else for(const i of s){const s=document.createElement("style"),n=e.litNonce;void 0!==n&&s.setAttribute("nonce",n),s.textContent=i.cssText,t.appendChild(s)}})(t,this.constructor.elementStyles),t}connectedCallback(){this.renderRoot??=this.createRenderRoot(),this.enableUpdating(!0),this._$EO?.forEach(t=>t.hostConnected?.())}enableUpdating(t){}disconnectedCallback(){this._$EO?.forEach(t=>t.hostDisconnected?.())}attributeChangedCallback(t,e,i){this._$AK(t,i)}_$ET(t,e){const i=this.constructor.elementProperties.get(t),s=this.constructor._$Eu(t,i);if(void 0!==s&&!0===i.reflect){const n=(void 0!==i.converter?.toAttribute?i.converter:y).toAttribute(e,i.type);this._$Em=t,null==n?this.removeAttribute(s):this.setAttribute(s,n),this._$Em=null}}_$AK(t,e){const i=this.constructor,s=i._$Eh.get(t);if(void 0!==s&&this._$Em!==s){const t=i.getPropertyOptions(s),n="function"==typeof t.converter?{fromAttribute:t.converter}:void 0!==t.converter?.fromAttribute?t.converter:y;this._$Em=s;const o=n.fromAttribute(e,t.type);this[s]=o??this._$Ej?.get(s)??o,this._$Em=null}}requestUpdate(t,e,i,s=!1,n){if(void 0!==t){const o=this.constructor;if(!1===s&&(n=this[t]),i??=o.getPropertyOptions(t),!((i.hasChanged??v)(n,e)||i.useDefault&&i.reflect&&n===this._$Ej?.get(t)&&!this.hasAttribute(o._$Eu(t,i))))return;this.C(t,e,i)}!1===this.isUpdatePending&&(this._$ES=this._$EP())}C(t,e,{useDefault:i,reflect:s,wrapped:n},o){i&&!(this._$Ej??=new Map).has(t)&&(this._$Ej.set(t,o??e??this[t]),!0!==n||void 0!==o)||(this._$AL.has(t)||(this.hasUpdated||i||(e=void 0),this._$AL.set(t,e)),!0===s&&this._$Em!==t&&(this._$Eq??=new Set).add(t))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(t){Promise.reject(t)}const t=this.scheduleUpdate();return null!=t&&await t,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??=this.createRenderRoot(),this._$Ep){for(const[t,e]of this._$Ep)this[t]=e;this._$Ep=void 0}const t=this.constructor.elementProperties;if(t.size>0)for(const[e,i]of t){const{wrapped:t}=i,s=this[e];!0!==t||this._$AL.has(e)||void 0===s||this.C(e,void 0,i,s)}}let t=!1;const e=this._$AL;try{t=this.shouldUpdate(e),t?(this.willUpdate(e),this._$EO?.forEach(t=>t.hostUpdate?.()),this.update(e)):this._$EM()}catch(e){throw t=!1,this._$EM(),e}t&&this._$AE(e)}willUpdate(t){}_$AE(t){this._$EO?.forEach(t=>t.hostUpdated?.()),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(t)),this.updated(t)}_$EM(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(t){return!0}update(t){this._$Eq&&=this._$Eq.forEach(t=>this._$ET(t,this[t])),this._$EM()}updated(t){}firstUpdated(t){}};x.elementStyles=[],x.shadowRootOptions={mode:"open"},x[b("elementProperties")]=new Map,x[b("finalized")]=new Map,g?.({ReactiveElement:x}),(m.reactiveElementVersions??=[]).push("2.1.2");const $=globalThis,k=t=>t,A=$.trustedTypes,S=A?A.createPolicy("lit-html",{createHTML:t=>t}):void 0,C="$lit$",E=`lit$${Math.random().toFixed(9).slice(2)}$`,T="?"+E,M=`<${T}>`,z=document,N=()=>z.createComment(""),H=t=>null===t||"object"!=typeof t&&"function"!=typeof t,O=Array.isArray,P="[ \t\n\f\r]",D=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,U=/-->/g,j=/>/g,L=RegExp(`>|${P}(?:([^\\s"'>=/]+)(${P}*=${P}*(?:[^ \t\n\f\r"'\`<>=]|("|')|))|$)`,"g"),I=/'/g,F=/"/g,R=/^(?:script|style|textarea|title)$/i,B=t=>(e,...i)=>({_$litType$:t,strings:e,values:i}),W=B(1),V=B(2),K=Symbol.for("lit-noChange"),q=Symbol.for("lit-nothing"),G=new WeakMap,Z=z.createTreeWalker(z,129);function J(t,e){if(!O(t)||!t.hasOwnProperty("raw"))throw Error("invalid template strings array");return void 0!==S?S.createHTML(e):e}const X=(t,e)=>{const i=t.length-1,s=[];let n,o=2===e?"<svg>":3===e?"<math>":"",r=D;for(let e=0;e<i;e++){const i=t[e];let a,c,l=-1,h=0;for(;h<i.length&&(r.lastIndex=h,c=r.exec(i),null!==c);)h=r.lastIndex,r===D?"!--"===c[1]?r=U:void 0!==c[1]?r=j:void 0!==c[2]?(R.test(c[2])&&(n=RegExp("</"+c[2],"g")),r=L):void 0!==c[3]&&(r=L):r===L?">"===c[0]?(r=n??D,l=-1):void 0===c[1]?l=-2:(l=r.lastIndex-c[2].length,a=c[1],r=void 0===c[3]?L:'"'===c[3]?F:I):r===F||r===I?r=L:r===U||r===j?r=D:(r=L,n=void 0);const d=r===L&&t[e+1].startsWith("/>")?" ":"";o+=r===D?i+M:l>=0?(s.push(a),i.slice(0,l)+C+i.slice(l)+E+d):i+E+(-2===l?e:d)}return[J(t,o+(t[i]||"<?>")+(2===e?"</svg>":3===e?"</math>":"")),s]};class Y{constructor({strings:t,_$litType$:e},i){let s;this.parts=[];let n=0,o=0;const r=t.length-1,a=this.parts,[c,l]=X(t,e);if(this.el=Y.createElement(c,i),Z.currentNode=this.el.content,2===e||3===e){const t=this.el.content.firstChild;t.replaceWith(...t.childNodes)}for(;null!==(s=Z.nextNode())&&a.length<r;){if(1===s.nodeType){if(s.hasAttributes())for(const t of s.getAttributeNames())if(t.endsWith(C)){const e=l[o++],i=s.getAttribute(t).split(E),r=/([.?@])?(.*)/.exec(e);a.push({type:1,index:n,name:r[2],strings:i,ctor:"."===r[1]?st:"?"===r[1]?nt:"@"===r[1]?ot:it}),s.removeAttribute(t)}else t.startsWith(E)&&(a.push({type:6,index:n}),s.removeAttribute(t));if(R.test(s.tagName)){const t=s.textContent.split(E),e=t.length-1;if(e>0){s.textContent=A?A.emptyScript:"";for(let i=0;i<e;i++)s.append(t[i],N()),Z.nextNode(),a.push({type:2,index:++n});s.append(t[e],N())}}}else if(8===s.nodeType)if(s.data===T)a.push({type:2,index:n});else{let t=-1;for(;-1!==(t=s.data.indexOf(E,t+1));)a.push({type:7,index:n}),t+=E.length-1}n++}}static createElement(t,e){const i=z.createElement("template");return i.innerHTML=t,i}}function Q(t,e,i=t,s){if(e===K)return e;let n=void 0!==s?i._$Co?.[s]:i._$Cl;const o=H(e)?void 0:e._$litDirective$;return n?.constructor!==o&&(n?._$AO?.(!1),void 0===o?n=void 0:(n=new o(t),n._$AT(t,i,s)),void 0!==s?(i._$Co??=[])[s]=n:i._$Cl=n),void 0!==n&&(e=Q(t,n._$AS(t,e.values),n,s)),e}let tt=class{constructor(t,e){this._$AV=[],this._$AN=void 0,this._$AD=t,this._$AM=e}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(t){const{el:{content:e},parts:i}=this._$AD,s=(t?.creationScope??z).importNode(e,!0);Z.currentNode=s;let n=Z.nextNode(),o=0,r=0,a=i[0];for(;void 0!==a;){if(o===a.index){let e;2===a.type?e=new et(n,n.nextSibling,this,t):1===a.type?e=new a.ctor(n,a.name,a.strings,this,t):6===a.type&&(e=new rt(n,this,t)),this._$AV.push(e),a=i[++r]}o!==a?.index&&(n=Z.nextNode(),o++)}return Z.currentNode=z,s}p(t){let e=0;for(const i of this._$AV)void 0!==i&&(void 0!==i.strings?(i._$AI(t,i,e),e+=i.strings.length-2):i._$AI(t[e])),e++}};class et{get _$AU(){return this._$AM?._$AU??this._$Cv}constructor(t,e,i,s){this.type=2,this._$AH=q,this._$AN=void 0,this._$AA=t,this._$AB=e,this._$AM=i,this.options=s,this._$Cv=s?.isConnected??!0}get parentNode(){let t=this._$AA.parentNode;const e=this._$AM;return void 0!==e&&11===t?.nodeType&&(t=e.parentNode),t}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(t,e=this){t=Q(this,t,e),H(t)?t===q||null==t||""===t?(this._$AH!==q&&this._$AR(),this._$AH=q):t!==this._$AH&&t!==K&&this._(t):void 0!==t._$litType$?this.$(t):void 0!==t.nodeType?this.T(t):(t=>O(t)||"function"==typeof t?.[Symbol.iterator])(t)?this.k(t):this._(t)}O(t){return this._$AA.parentNode.insertBefore(t,this._$AB)}T(t){this._$AH!==t&&(this._$AR(),this._$AH=this.O(t))}_(t){this._$AH!==q&&H(this._$AH)?this._$AA.nextSibling.data=t:this.T(z.createTextNode(t)),this._$AH=t}$(t){const{values:e,_$litType$:i}=t,s="number"==typeof i?this._$AC(t):(void 0===i.el&&(i.el=Y.createElement(J(i.h,i.h[0]),this.options)),i);if(this._$AH?._$AD===s)this._$AH.p(e);else{const t=new tt(s,this),i=t.u(this.options);t.p(e),this.T(i),this._$AH=t}}_$AC(t){let e=G.get(t.strings);return void 0===e&&G.set(t.strings,e=new Y(t)),e}k(t){O(this._$AH)||(this._$AH=[],this._$AR());const e=this._$AH;let i,s=0;for(const n of t)s===e.length?e.push(i=new et(this.O(N()),this.O(N()),this,this.options)):i=e[s],i._$AI(n),s++;s<e.length&&(this._$AR(i&&i._$AB.nextSibling,s),e.length=s)}_$AR(t=this._$AA.nextSibling,e){for(this._$AP?.(!1,!0,e);t!==this._$AB;){const e=k(t).nextSibling;k(t).remove(),t=e}}setConnected(t){void 0===this._$AM&&(this._$Cv=t,this._$AP?.(t))}}let it=class{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(t,e,i,s,n){this.type=1,this._$AH=q,this._$AN=void 0,this.element=t,this.name=e,this._$AM=s,this.options=n,i.length>2||""!==i[0]||""!==i[1]?(this._$AH=Array(i.length-1).fill(new String),this.strings=i):this._$AH=q}_$AI(t,e=this,i,s){const n=this.strings;let o=!1;if(void 0===n)t=Q(this,t,e,0),o=!H(t)||t!==this._$AH&&t!==K,o&&(this._$AH=t);else{const s=t;let r,a;for(t=n[0],r=0;r<n.length-1;r++)a=Q(this,s[i+r],e,r),a===K&&(a=this._$AH[r]),o||=!H(a)||a!==this._$AH[r],a===q?t=q:t!==q&&(t+=(a??"")+n[r+1]),this._$AH[r]=a}o&&!s&&this.j(t)}j(t){t===q?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,t??"")}};class st extends it{constructor(){super(...arguments),this.type=3}j(t){this.element[this.name]=t===q?void 0:t}}class nt extends it{constructor(){super(...arguments),this.type=4}j(t){this.element.toggleAttribute(this.name,!!t&&t!==q)}}class ot extends it{constructor(t,e,i,s,n){super(t,e,i,s,n),this.type=5}_$AI(t,e=this){if((t=Q(this,t,e,0)??q)===K)return;const i=this._$AH,s=t===q&&i!==q||t.capture!==i.capture||t.once!==i.once||t.passive!==i.passive,n=t!==q&&(i===q||s);s&&this.element.removeEventListener(this.name,this,i),n&&this.element.addEventListener(this.name,this,t),this._$AH=t}handleEvent(t){"function"==typeof this._$AH?this._$AH.call(this.options?.host??this.element,t):this._$AH.handleEvent(t)}}class rt{constructor(t,e,i){this.element=t,this.type=6,this._$AN=void 0,this._$AM=e,this.options=i}get _$AU(){return this._$AM._$AU}_$AI(t){Q(this,t)}}const at=$.litHtmlPolyfillSupport;at?.(Y,et),($.litHtmlVersions??=[]).push("3.3.3");const ct=globalThis;class lt extends x{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){const t=super.createRenderRoot();return this.renderOptions.renderBefore??=t.firstChild,t}update(t){const e=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(t),this._$Do=((t,e,i)=>{const s=i?.renderBefore??e;let n=s._$litPart$;if(void 0===n){const t=i?.renderBefore??null;s._$litPart$=n=new et(e.insertBefore(N(),t),t,void 0,i??{})}return n._$AI(t),n})(e,this.renderRoot,this.renderOptions)}connectedCallback(){super.connectedCallback(),this._$Do?.setConnected(!0)}disconnectedCallback(){super.disconnectedCallback(),this._$Do?.setConnected(!1)}render(){return K}}lt._$litElement$=!0,lt.finalized=!0,ct.litElementHydrateSupport?.({LitElement:lt});const ht=ct.litElementPolyfillSupport;ht?.({LitElement:lt}),(ct.litElementVersions??=[]).push("4.2.2");const dt=t=>(e,i)=>{void 0!==i?i.addInitializer(()=>{customElements.define(t,e)}):customElements.define(t,e)},pt={attribute:!0,type:String,converter:y,reflect:!1,hasChanged:v},ut=(t=pt,e,i)=>{const{kind:s,metadata:n}=i;let o=globalThis.litPropertyMetadata.get(n);if(void 0===o&&globalThis.litPropertyMetadata.set(n,o=new Map),"setter"===s&&((t=Object.create(t)).wrapped=!0),o.set(i.name,t),"accessor"===s){const{name:s}=i;return{set(i){const n=e.get.call(this);e.set.call(this,i),this.requestUpdate(s,n,t,!0,i)},init(e){return void 0!==e&&this.C(s,void 0,t,e),e}}}if("setter"===s){const{name:s}=i;return function(i){const n=this[s];e.call(this,i),this.requestUpdate(s,n,t,!0,i)}}throw Error("Unsupported decorator location: "+s)};function mt(t){return(e,i)=>"object"==typeof i?ut(t,e,i):((t,e,i)=>{const s=e.hasOwnProperty(i);return e.constructor.createProperty(i,t),s?Object.getOwnPropertyDescriptor(e,i):void 0})(t,e,i)}function _t(t){return mt({...t,state:!0,attribute:!1})}const ft=1,gt=2,bt=4,yt=8,vt=16,wt=32,xt=128,$t=256,kt=512,At=(t,e)=>0!==((t.supported_features??0)&e),St=["auto","heat_cool","heat","cool","dry","fan_only","off"],Ct={auto:"mdi:thermostat-auto",heat_cool:"mdi:sun-snowflake-variant",heat:"mdi:fire",cool:"mdi:snowflake",dry:"mdi:water-percent",fan_only:"mdi:fan",off:"mdi:power"},Et={heating:"mdi:fire",cooling:"mdi:snowflake",drying:"mdi:water-percent",fan:"mdi:fan",idle:"mdi:clock-outline",off:"mdi:power",preheating:"mdi:heat-wave",defrosting:"mdi:snowflake-melt"},Tt={auto:"var(--state-climate-auto-color, #43a047)",heat_cool:"var(--state-climate-heat_cool-color, #ffa000)",heat:"var(--state-climate-heat-color, #ff6d00)",cool:"var(--state-climate-cool-color, #2196f3)",dry:"var(--state-climate-dry-color, #00bcd4)",fan_only:"var(--state-climate-fan_only-color, #00acc1)",off:"var(--state-climate-off-color, #8a8a8a)"},Mt={heating:"heat",preheating:"heat",cooling:"cool",drying:"dry",fan:"fan_only",defrosting:"cool"},zt={modes:!0,fan:!0,swing:!0,presets:!0,humidity:!0,sensors:!0,graph:!1,shortcuts:!0,timer:!0,airflow:!0,hints:!0},Nt=["modes","fan","timer","countdown","shortcuts"],Ht=["switch","button"];const Ot={de:{card:{current:"Aktuell",target:"Ziel",humidity:"Luftfeuchte",target_humidity:"Ziel-Luftfeuchte",outdoor:"Außen",power:"Leistung",energy:"Energie",fan:"Lüfter",swing:"Lamellen",swing_horizontal:"Lamellen horizontal",preset:"Voreinstellung",mode:"Modus",history:"Verlauf",window_open:"Fenster offen",window_open_hint:"Ein Fenster ist geöffnet – Klimaanlage ggf. ausschalten.",unavailable:"Nicht verfügbar",entity_not_found:"Entität nicht gefunden",more:"Mehr",less:"Weniger",turn_on:"Einschalten",turn_off:"Ausschalten",no_history:"Keine Verlaufsdaten",shortcuts:"Schalter",sleep_timer:"Sleeptimer",timer_off:"Inaktiv",timer_at:"Aus um",timer_in:"in",ventilate_cool:"Lüften statt Kühlen",ventilate_heat:"Lüften statt Heizen",ventilate_hint:"Fenster öffnen spart Strom.",outside:"Draußen",inside:"drinnen",humidity_high:"Luftfeuchte hoch",mold_hint:"Schimmelgefahr – Entfeuchten oder Lüften empfohlen",dew_point:"Taupunkt",start_dry:"Entfeuchten",today:"Heute",countdown:"Ausschalten in",cancel:"Abbrechen"},hvac_mode:{off:"Aus",heat:"Heizen",cool:"Kühlen",heat_cool:"Heizen/Kühlen",auto:"Automatisch",dry:"Entfeuchten",fan_only:"Nur Lüfter"},hvac_action:{off:"Aus",heating:"Heizt",cooling:"Kühlt",drying:"Entfeuchtet",idle:"Leerlauf",fan:"Lüftet",preheating:"Vorheizen",defrosting:"Abtauen"},editor:{entity:"Klima-Entität",name:"Name",icon:"Symbol",layout:"Layout",layout_full:"Voll (Drehregler)",layout_compact:"Kompakt (Kachel)",sections:"Sichtbare Bereiche",show_modes:"Betriebsmodi",show_fan:"Lüfterstufen",show_swing:"Lamellen",show_presets:"Voreinstellungen",show_humidity:"Ziel-Luftfeuchte",show_sensors:"Sensoren",show_graph:"Verlaufsgraph",sensors:"Zusätzliche Sensoren",temperature_sensor:"Ist-Temperatur: Sensor oder Thermostat (leer = Klimaanlage)",humidity_sensor:"Raumluftfeuchte-Sensor",outdoor_sensor:"Außentemperatur-Sensor",power_sensor:"Leistungssensor",energy_sensor:"Energiesensor",window_sensor:"Fenster-/Türkontakt",use_sensor_for_current:"Als Ist-Temperatur verwenden (aus = nur als Kachel)",graph_hours:"Zeitraum Graph (Stunden)",show_shortcuts:"Schalter-Buttons",shortcuts_section:"Schalter-Buttons",shortcuts:"Entitäten (Schalter, Skripte, Szenen, Buttons)",auto_shortcuts:"Schalter des Geräts automatisch übernehmen",appearance:"Darstellung",expandable:"Details ausklappbar (volles Layout)",start_expanded:"Anfangs ausgeklappt",dropdown_threshold:"Dropdown ab so vielen Optionen (0 = immer Chips)",show_timer:"Sleeptimer",timer_section:"Sleeptimer",timer_switch:"Schalter zum Scharfschalten (input_boolean)",timer_time:"Ausschaltzeit (input_datetime)",show_airflow:"Luftstrom-Animation",show_hints:"Hinweise (Lüften, Taupunkt, Schimmel)",weather_entity:"Wetter (Vorhersage heute)",countdown_timer:"Schnell-Timer (timer-Helfer)",countdown_durations:"Timer-Dauern in Minuten (z.B. 30, 60, 90)",ventilation_delta:"Lüften-Hinweis ab Temperaturdifferenz (°)",humidity_warning:"Schimmel-Warnung ab Luftfeuchte (%, 0 = aus)",hints_section:"Hinweise & Wetter"},overview:{title:"Klimaanlagen",of:"von",running:"aktiv",all_off:"Alle aus",editor_title:"Titel",editor_entities:"Klimageräte",editor_show_all_off:"„Alle aus“-Button",editor_show_controls:"Temperatur-Regler"}},en:{card:{current:"Current",target:"Target",humidity:"Humidity",target_humidity:"Target humidity",outdoor:"Outdoor",power:"Power",energy:"Energy",fan:"Fan",swing:"Swing",swing_horizontal:"Horizontal swing",preset:"Preset",mode:"Mode",history:"History",window_open:"Window open",window_open_hint:"A window is open – consider turning off the air conditioner.",unavailable:"Unavailable",entity_not_found:"Entity not found",more:"More",less:"Less",turn_on:"Turn on",turn_off:"Turn off",no_history:"No history data",shortcuts:"Shortcuts",sleep_timer:"Sleep timer",timer_off:"Inactive",timer_at:"Off at",timer_in:"in",ventilate_cool:"Ventilate instead of cooling",ventilate_heat:"Ventilate instead of heating",ventilate_hint:"Opening a window saves energy.",outside:"Outside",inside:"inside",humidity_high:"High humidity",mold_hint:"Risk of mould – dehumidify or ventilate",dew_point:"Dew point",start_dry:"Dehumidify",today:"Today",countdown:"Turn off in",cancel:"Cancel"},hvac_mode:{off:"Off",heat:"Heat",cool:"Cool",heat_cool:"Heat/Cool",auto:"Auto",dry:"Dry",fan_only:"Fan only"},hvac_action:{off:"Off",heating:"Heating",cooling:"Cooling",drying:"Drying",idle:"Idle",fan:"Fan",preheating:"Preheating",defrosting:"Defrosting"},editor:{entity:"Climate entity",name:"Name",icon:"Icon",layout:"Layout",layout_full:"Full (dial)",layout_compact:"Compact (tile)",sections:"Visible sections",show_modes:"HVAC modes",show_fan:"Fan modes",show_swing:"Swing modes",show_presets:"Presets",show_humidity:"Target humidity",show_sensors:"Sensors",show_graph:"History graph",sensors:"Additional sensors",temperature_sensor:"Current temperature: sensor or thermostat (empty = air conditioner)",humidity_sensor:"Room humidity sensor",outdoor_sensor:"Outdoor temperature sensor",power_sensor:"Power sensor",energy_sensor:"Energy sensor",window_sensor:"Window / door contact",use_sensor_for_current:"Use as current temperature (off = tile only)",graph_hours:"Graph period (hours)",show_shortcuts:"Shortcut buttons",shortcuts_section:"Shortcut buttons",shortcuts:"Entities (switches, scripts, scenes, buttons)",auto_shortcuts:"Automatically add the device's switches",appearance:"Appearance",expandable:"Collapsible details (full layout)",start_expanded:"Start expanded",dropdown_threshold:"Dropdown from this many options (0 = always chips)",show_timer:"Sleep timer",timer_section:"Sleep timer",timer_switch:"Arming switch (input_boolean)",timer_time:"Off time (input_datetime)",show_airflow:"Airflow animation",show_hints:"Hints (ventilation, dew point, mould)",weather_entity:"Weather (today's forecast)",countdown_timer:"Quick timer (timer helper)",countdown_durations:"Timer durations in minutes (e.g. 30, 60, 90)",ventilation_delta:"Ventilation hint from temperature difference (°)",humidity_warning:"Mould warning from humidity (%, 0 = off)",hints_section:"Hints & weather"},overview:{title:"Air conditioners",of:"of",running:"running",all_off:"All off",editor_title:"Title",editor_entities:"Climate entities",editor_show_all_off:'"All off" button',editor_show_controls:"Temperature controls"}}},Pt=(t,e)=>{let i=Ot[t];for(const t of e.split(".")){if(null==i||"object"!=typeof i)return;i=i[t]}return"string"==typeof i?i:void 0},Dt=t=>{const e=(t?.locale?.language??t?.language??navigator.language??"en").split("-")[0].toLowerCase();return e in Ot?e:"en"},Ut=(t,e)=>Pt(Dt(t),e)??Pt("en",e)??e,jt=t=>t.replace(/_/g," ").replace(/^\w/,t=>t.toUpperCase()),Lt=(t,e,i,s)=>{if(t.formatEntityAttributeValue){const n=t.formatEntityAttributeValue(e,i,s);if(n&&n!==s)return n}return"hvac_action"===i?Pt(Dt(t),`hvac_action.${s}`)??jt(s):jt(s)},It=(t,e,i)=>{if(t.formatEntityState){const s=t.formatEntityState(e,i);if(s&&s!==i)return s}return Pt(Dt(t),`hvac_mode.${i}`)??jt(i)},Ft=r`
  :host { display: block; }
  ha-card {
    position: relative; overflow: hidden; padding: 16px; box-sizing: border-box; height: 100%;
    display: flex; flex-direction: column; gap: 14px;
    transition: background 0.4s; isolation: isolate;
  }
  .glow {
    position: absolute; inset: -40% -20% auto -20%; height: 70%; pointer-events: none; z-index: -1;
    background: radial-gradient(closest-side, color-mix(in srgb, var(--accent) 18%, transparent), transparent);
    transition: background 0.6s;
  }
  ha-card.compact .glow { inset: -60% -30% auto auto; width: 70%; height: 140%; }
  button { font: inherit; color: inherit; }

  /* Header */
  .header { position: relative; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .title {
    display: flex; align-items: center; gap: 12px; background: none; border: none; padding: 0;
    cursor: pointer; text-align: left; min-width: 0;
  }
  .icon-badge {
    flex: none; width: 42px; height: 42px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
    background: color-mix(in srgb, var(--accent) 20%, transparent); color: var(--accent);
    transition: background 0.4s, color 0.4s;
  }
  .icon-badge.active ha-icon { animation: breathe 2.4s ease-in-out infinite; }
  .names { display: flex; flex-direction: column; min-width: 0; }
  .name { font-size: 16px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .status { font-size: 13px; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .power {
    flex: none; width: 42px; height: 42px; border-radius: 50%; border: none; cursor: pointer;
    background: rgba(127,127,127,0.12); color: var(--secondary-text-color);
    display: flex; align-items: center; justify-content: center; transition: background 0.25s, color 0.25s;
  }
  .power.on { background: var(--accent); color: var(--text-primary-color, #fff); }
  .power:focus-visible, .title:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

  /* Window banner */
  .banner {
    position: relative; display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 12px; cursor: pointer;
    background: color-mix(in srgb, var(--warning-color, #ff9800) 18%, transparent); color: var(--primary-text-color);
  }
  .banner ha-icon { color: var(--warning-color, #ff9800); flex: none; }
  .banner div { display: flex; flex-direction: column; font-size: 13px; }
  .banner span { color: var(--secondary-text-color); font-size: 12px; }
  .banner div { flex: 1; min-width: 0; }
  .banner.info { cursor: default; background: color-mix(in srgb, var(--info-color, #039be5) 15%, transparent); }
  .banner.info ha-icon { color: var(--info-color, #039be5); }
  .banner.humid { cursor: default; background: color-mix(in srgb, var(--state-climate-dry-color, #00bcd4) 16%, transparent); }
  .banner.humid ha-icon { color: var(--state-climate-dry-color, #00bcd4); }
  .banner-action {
    flex: none; border: none; border-radius: 999px; padding: 6px 12px; font: inherit; font-size: 12px; font-weight: 600; cursor: pointer;
    background: var(--state-climate-dry-color, #00bcd4); color: #fff;
  }
  .hints { position: relative; display: flex; flex-direction: column; gap: 8px; }

  /* Dial */
  .dial-center { display: flex; flex-direction: column; align-items: center; gap: 2px; }
  .dial-label { font-size: 13px; color: var(--secondary-text-color); text-transform: uppercase; letter-spacing: 0.06em; }
  .dial-big { font-size: clamp(40px, 13vw, 58px); font-weight: 300; line-height: 1; letter-spacing: -0.02em; }
  .dial-big sup, .big sup { font-size: 0.4em; font-weight: 400; vertical-align: top; margin-left: 2px; position: relative; top: 0.25em; }
  .dial-range { font-size: clamp(28px, 9vw, 38px); font-weight: 400; display: flex; gap: 6px; align-items: baseline; }
  .dial-range .sep { color: var(--secondary-text-color); font-size: 0.7em; }
  .dial-sub { display: flex; align-items: center; gap: 4px; font-size: 14px; color: var(--secondary-text-color); margin-top: 4px; }
  .dial-sub ha-icon { --mdc-icon-size: 16px; margin-left: 4px; }
  .dial-steppers { display: flex; justify-content: center; gap: 16px; margin-top: -24px; position: relative; flex-wrap: wrap; }
  .dial-steppers.dual { gap: 8px; margin-top: -8px; }
  hcc-climate-dial { margin-bottom: -16px; }
  .round {
    width: 48px; height: 48px; border-radius: 50%; border: none; cursor: pointer;
    background: rgba(127,127,127,0.12); display: flex; align-items: center; justify-content: center;
    transition: background 0.2s, transform 0.1s;
  }
  .round:hover { background: color-mix(in srgb, var(--accent) 20%, transparent); }
  .round:active { transform: scale(0.92); }

  /* Stepper */
  .stepper {
    display: inline-flex; align-items: center; gap: 4px; padding: 4px; border-radius: 999px;
    background: rgba(127,127,127,0.12);
  }
  .stepper button {
    width: 34px; height: 34px; border-radius: 50%; border: none; cursor: pointer; background: transparent;
    display: flex; align-items: center; justify-content: center; color: var(--accent, var(--primary-text-color));
  }
  .stepper button:hover { background: color-mix(in srgb, var(--accent, #888) 20%, transparent); }
  .stepper-value { min-width: 54px; text-align: center; font-size: 18px; font-weight: 600; }
  .stepper-value small { font-size: 11px; font-weight: 400; color: var(--secondary-text-color); margin-left: 1px; }

  /* Controls */
  .controls { position: relative; display: flex; flex-direction: column; gap: 14px; }
  .row-label {
    display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 500; color: var(--secondary-text-color);
    text-transform: uppercase; letter-spacing: 0.04em;
  }
  .row-label ha-icon { --mdc-icon-size: 16px; }
  .humidity-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .graph-wrap { display: flex; flex-direction: column; gap: 6px; }

  /* Compact */
  .compact-row { position: relative; display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
  .compact-current { display: flex; flex-direction: column; }
  .big { font-size: 34px; font-weight: 300; line-height: 1; }
  .compact-steppers { display: flex; gap: 6px; flex-wrap: wrap; }
  .expand {
    position: relative; align-self: center; display: flex; align-items: center; gap: 2px; border: none; background: none;
    color: var(--secondary-text-color); cursor: pointer; font-size: 12px; padding: 2px 8px; border-radius: 999px; margin: -6px 0;
  }
  .expand:hover { background: rgba(127,127,127,0.12); }

  .warning { padding: 8px; color: var(--error-color, #db4437); }
  ha-card.unavailable { opacity: 0.6; }

  @keyframes breathe { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.12); } }
  @media (prefers-reduced-motion: reduce) { .icon-badge.active ha-icon { animation: none; } }
`,Rt=135,Bt=270,Wt=82,Vt=(t,e=Wt)=>{const i=t*Math.PI/180;return{x:100+e*Math.cos(i),y:100+e*Math.sin(i)}},Kt=(t,e,i=Wt)=>{if(e-t<.01)return"";const s=Vt(t,i),n=Vt(e,i),o=e-t>180?1:0;return`M ${s.x} ${s.y} A ${i} ${i} 0 ${o} 1 ${n.x} ${n.y}`};let qt=class extends lt{constructor(){super(...arguments),this.min=16,this.max=30,this.step=.5,this.dual=!1,this.disabled=!1,this.color="var(--primary-color)",this.lowColor="var(--state-climate-heat-color, #ff6d00)",this.highColor="var(--state-climate-cool-color, #2196f3)",this.active=!1,this.fade=!1,this.showCurrentLabel=!0}_clamp(t){const e=Math.round((t-this.min)/this.step)*this.step+this.min,i=Number(e.toFixed(this.step<1?1:0));return Math.min(this.max,Math.max(this.min,i))}_toAngle(t){const e=this.max-this.min||1,i=Math.min(1,Math.max(0,(t-this.min)/e));return Rt+Bt*i}_fromPointer(t){const e=this.shadowRoot.querySelector("svg").getBoundingClientRect(),i=(t.clientX-e.left)/e.width*200-100,s=(t.clientY-e.top)/e.height*200-100;let n=(180*Math.atan2(s,i)/Math.PI-Rt+720)%360;return n>Bt&&(n=n>315?0:Bt),this._clamp(this.min+n/Bt*(this.max-this.min))}_pickHandle(t){if(!this.dual)return"value";const e=this.low??this.min,i=this.high??this.max;return t<=e?"low":t>=i?"high":t-e<i-t?"low":"high"}_apply(t,e){"value"===t?this.value=e:"low"===t?this.low=Math.min(e,this.high??this.max):this.high=Math.max(e,this.low??this.min)}_emit(t){const e=this.dual?{low:this.low,high:this.high}:{value:this.value};this.dispatchEvent(new CustomEvent(t,{detail:e,bubbles:!0,composed:!0}))}_onPointerDown(t){if(this.disabled)return;t.preventDefault();const e=this._fromPointer(t);this._dragging=this._pickHandle(e),t.currentTarget.setPointerCapture(t.pointerId),this._apply(this._dragging,e),this._emit("value-changing")}_onPointerMove(t){this._dragging&&(this._apply(this._dragging,this._fromPointer(t)),this._emit("value-changing"))}_onPointerUp(t){this._dragging&&(t.currentTarget.releasePointerCapture?.(t.pointerId),this._dragging=void 0,this._emit("value-changed"))}_onKey(t,e){if(this.disabled)return;const i={ArrowUp:this.step,ArrowRight:this.step,ArrowDown:-this.step,ArrowLeft:-this.step,PageUp:5*this.step,PageDown:5*-this.step};if(!(e.key in i))return;e.preventDefault();const s="value"===t?this.value:"low"===t?this.low:this.high;this._apply(t,this._clamp((s??this.min)+i[e.key])),this._emit("value-changed")}_handle(t,e,i){if(null==e)return q;const s=Vt(this._toAngle(e));return V`
      <g class="handle ${this._dragging===t?"dragging":""}" tabindex=${this.disabled?-1:0}
        role="slider" aria-valuemin=${this.min} aria-valuemax=${this.max} aria-valuenow=${e}
        aria-label=${t} @keydown=${e=>this._onKey(t,e)}>
        <circle cx=${s.x} cy=${s.y} r="13" class="halo" style="fill:${i}"></circle>
        <circle cx=${s.x} cy=${s.y} r="9" class="knob" style="stroke:${i}"></circle>
      </g>`}_gradientArc(t,e,i,s,n="delta"){const o=e-t;if(o<.5)return q;const r=Math.max(2,Math.ceil(o/2)),a=o/r,c=Array.from({length:r},(n,o)=>{const c=t+o*a,l=Math.min(e,c+a+(o<r-1?.6:0)),h=((o+.5)/r*100).toFixed(1);return V`<path d=${Kt(c,l)} style="stroke:color-mix(in srgb, ${s} ${h}%, ${i})"></path>`}),l=Vt(t),h=Vt(e);return V`<g class=${n}>
      <circle cx=${l.x} cy=${l.y} r="7" style="fill:${i}"></circle>
      <circle cx=${h.x} cy=${h.y} r="7" style="fill:${s}"></circle>
      ${c}
    </g>`}_currentColor(t){return this.fade?`color-mix(in srgb, ${this.color} 25%, transparent)`:(this.current??t)>t?this.lowColor:this.highColor}_flow(t,e){if(!this.active)return q;const i=this._toAngle(t),s=this._toAngle(e);if(Math.abs(s-i)<4)return q;return V`<path class="flow ${s>i?"up":"down"}" d=${Kt(Math.min(i,s),Math.max(i,s))}></path>`}_deltaArc(t){if(null==this.current)return q;const e=Math.min(this.max,Math.max(this.min,this.current)),i=this._toAngle(e),s=this._toAngle(t),n=this._currentColor(t),o=i<s?this._gradientArc(i,s,n,this.color):this._gradientArc(s,i,this.color,n);return V`${o}${this._flow(e,t)}`}render(){let t=q;if(!this.disabled)if(this.dual&&null!=this.low&&null!=this.high){const e=V`<path class="zone" d=${Kt(this._toAngle(this.low),this._toAngle(this.high))}
          style="stroke:url(#rangeGrad)"></path>`;let i=q;null!=this.current&&this.current<this.low?i=V`${this._gradientArc(this._toAngle(Math.max(this.min,this.current)),this._toAngle(this.low),this.highColor,this.lowColor)}${this._flow(this.current,this.low)}`:null!=this.current&&this.current>this.high&&(i=V`${this._gradientArc(this._toAngle(this.high),this._toAngle(Math.min(this.max,this.current)),this.highColor,this.lowColor)}${this._flow(this.current,this.high)}`),t=V`${e}${i}`}else null!=this.value&&(t=null!=this.current?this._deltaArc(this.value):V`<path class="active" d=${Kt(Rt,this._toAngle(this.value))} style="stroke:${this.color}"></path>`);const e=null!=this.current?Math.min(this.max,Math.max(this.min,this.current)):void 0,i=null!=e?this._toAngle(e):void 0,s=null!=i?Vt(i,Wt):void 0,n=null!=i?Vt(i,62):void 0,o=this.dual?void 0:this.value,r=this.disabled||null==o?"var(--secondary-text-color)":this._currentColor(o),a=Array.from({length:55},(t,e)=>Rt+5*e);return W`
      <div class="dial ${this.active?"is-active":""}" style="--dial-color:${this.color}">
        <svg viewBox="0 0 200 200"
          @pointerdown=${this._onPointerDown} @pointermove=${this._onPointerMove}
          @pointerup=${this._onPointerUp} @pointercancel=${this._onPointerUp}>
          <defs>
            <linearGradient id="rangeGrad" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0%" stop-color=${this.lowColor}></stop>
              <stop offset="100%" stop-color=${this.highColor}></stop>
            </linearGradient>
          </defs>
          ${a.map(t=>{const e=Vt(t,98),i=Vt(t,93);return V`<line class="tick" x1=${e.x} y1=${e.y} x2=${i.x} y2=${i.y}></line>`})}
          <path class="track" d=${Kt(Rt,405)}
            style=${this.disabled?"":`stroke:color-mix(in srgb, ${this.color} 10%, var(--hcc-track, rgba(127,127,127,0.22)))`}></path>
          ${t}
          ${s&&n&&null!=e?V`
            <circle class="current" cx=${s.x} cy=${s.y} r="5.5" style="stroke:${r}"></circle>
            ${this.showCurrentLabel?V`<text class="current-label" x=${n.x} y=${n.y}>${e.toFixed(this.step<1?1:0)}°</text>`:q}`:q}
          ${this.disabled?q:this.dual?[this._handle("low",this.low,this.lowColor),this._handle("high",this.high,this.highColor)]:this._handle("value",this.value,this.color)}
        </svg>
        <div class="center"><slot></slot></div>
      </div>
    `}};qt.styles=r`
    :host { display: block; width: 100%; max-width: 320px; margin: 0 auto; }
    .dial { position: relative; width: 100%; aspect-ratio: 1; }
    svg { width: 100%; height: 100%; touch-action: none; user-select: none; overflow: visible; }
    .track { fill: none; stroke: var(--hcc-track, rgba(127,127,127,0.22)); stroke-width: 14; stroke-linecap: round; transition: stroke 0.4s; }
    .active { fill: none; stroke-width: 14; stroke-linecap: round; transition: stroke 0.4s; }
    .zone { fill: none; stroke-width: 14; stroke-linecap: round; opacity: 0.45; }
    .delta path { fill: none; stroke-width: 14; stroke-linecap: butt; }
    .flow { fill: none; stroke: #fff; stroke-opacity: 0.55; stroke-width: 3; stroke-linecap: round; stroke-dasharray: 0.1 9; pointer-events: none; }
    .flow.up { animation: flow-up 1.4s linear infinite; }
    .flow.down { animation: flow-down 1.4s linear infinite; }
    .current-label { font-size: 9px; font-weight: 600; fill: var(--secondary-text-color); text-anchor: middle; dominant-baseline: central; pointer-events: none; }
    .tick { stroke: var(--secondary-text-color); stroke-opacity: 0.25; stroke-width: 1.2; stroke-linecap: round; }
    .is-active .tick { stroke: var(--dial-color); stroke-opacity: 0.45; animation: pulse 2.4s ease-in-out infinite; }
    .current { fill: var(--card-background-color, #fff); stroke-width: 3; filter: drop-shadow(0 1px 1.5px rgba(0,0,0,0.3)); }
    .handle { cursor: grab; outline: none; }
    .handle .halo { opacity: 0; transition: opacity 0.2s; }
    .handle:hover .halo, .handle:focus-visible .halo, .handle.dragging .halo { opacity: 0.25; }
    .handle.dragging { cursor: grabbing; }
    .knob { fill: var(--card-background-color, #fff); stroke-width: 4; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.35)); }
    .center {
      position: absolute; inset: 22%; display: flex; flex-direction: column;
      align-items: center; justify-content: center; text-align: center; pointer-events: none;
    }
    .center ::slotted(*) { pointer-events: auto; }
    @keyframes flow-up { from { stroke-dashoffset: 18; } to { stroke-dashoffset: 0; } }
    @keyframes flow-down { from { stroke-dashoffset: 0; } to { stroke-dashoffset: 18; } }
    @keyframes pulse { 0%, 100% { stroke-opacity: 0.2; } 50% { stroke-opacity: 0.6; } }
    @media (prefers-reduced-motion: reduce) { .is-active .tick, .flow { animation: none; } }
  `,t([mt({type:Number})],qt.prototype,"min",void 0),t([mt({type:Number})],qt.prototype,"max",void 0),t([mt({type:Number})],qt.prototype,"step",void 0),t([mt({type:Number})],qt.prototype,"value",void 0),t([mt({type:Number})],qt.prototype,"low",void 0),t([mt({type:Number})],qt.prototype,"high",void 0),t([mt({type:Number})],qt.prototype,"current",void 0),t([mt({type:Boolean})],qt.prototype,"dual",void 0),t([mt({type:Boolean})],qt.prototype,"disabled",void 0),t([mt()],qt.prototype,"color",void 0),t([mt()],qt.prototype,"lowColor",void 0),t([mt()],qt.prototype,"highColor",void 0),t([mt({type:Boolean})],qt.prototype,"active",void 0),t([mt({type:Boolean})],qt.prototype,"fade",void 0),t([mt({type:Boolean})],qt.prototype,"showCurrentLabel",void 0),t([_t()],qt.prototype,"_dragging",void 0),qt=t([dt("hcc-climate-dial")],qt);let Gt=class extends lt{constructor(){super(...arguments),this.modes=[],this.disabled=!1}_select(t){this.disabled||t===this.selected||this.dispatchEvent(new CustomEvent("mode-selected",{detail:{mode:t},bubbles:!0,composed:!0}))}render(){return W`<div class="bar" role="radiogroup">
      ${this.modes.map(t=>W`
        <button class="mode ${t.value===this.selected?"on":""}" role="radio"
          aria-checked=${t.value===this.selected} title=${t.label} aria-label=${t.label}
          ?disabled=${this.disabled} style="--mode-color:${Tt[t.value]??"var(--primary-color)"}"
          @click=${()=>this._select(t.value)}>
          <ha-icon .icon=${Ct[t.value]??"mdi:thermostat"}></ha-icon>
        </button>`)}
    </div>`}};Gt.styles=r`
    .bar { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; }
    .mode {
      flex: 1 1 0; min-width: 40px; max-width: 64px; height: 44px; border: none; border-radius: 14px;
      background: var(--hcc-chip-bg, rgba(127,127,127,0.12)); color: var(--secondary-text-color);
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      transition: background 0.25s, color 0.25s, transform 0.1s;
    }
    .mode:hover { background: rgba(127,127,127,0.2); }
    .mode:active { transform: scale(0.94); }
    .mode.on { background: color-mix(in srgb, var(--mode-color) 22%, transparent); color: var(--mode-color); }
    .mode:focus-visible { outline: 2px solid var(--mode-color); outline-offset: 2px; }
    .mode:disabled { cursor: default; opacity: 0.5; }
    ha-icon { --mdc-icon-size: 22px; }
  `,t([mt({attribute:!1})],Gt.prototype,"modes",void 0),t([mt()],Gt.prototype,"selected",void 0),t([mt({type:Boolean})],Gt.prototype,"disabled",void 0),Gt=t([dt("hcc-mode-bar")],Gt);let Zt=class extends lt{constructor(){super(...arguments),this.label="",this.options=[],this.disabled=!1,this.dropdownThreshold=6}_select(t){this.disabled||t===this.selected||this.dispatchEvent(new CustomEvent("option-selected",{detail:{value:t},bubbles:!0,composed:!0}))}get _useDropdown(){return this.dropdownThreshold>0&&this.options.length>this.dropdownThreshold}_renderDropdown(){return W`<div class="dropdown-row">
      ${this._renderHead()}
      <label class="select">
        <select aria-label=${this.label} ?disabled=${this.disabled}
          @change=${t=>this._select(t.target.value)}>
          ${null==this.selected||this.options.some(t=>t.value===this.selected)?q:W`<option value=${this.selected} selected>${this.selected}</option>`}
          ${this.options.map(t=>W`<option value=${t.value} ?selected=${t.value===this.selected}>${t.label}</option>`)}
        </select>
        <ha-icon icon="mdi:chevron-down"></ha-icon>
      </label>
    </div>`}_renderHead(){return W`<div class="head">
      ${this.icon?W`<ha-icon .icon=${this.icon}></ha-icon>`:q}
      <span>${this.label}</span>
    </div>`}render(){return this._useDropdown?this._renderDropdown():W`
      <div class="head">
        ${this.icon?W`<ha-icon .icon=${this.icon}></ha-icon>`:q}
        <span>${this.label}</span>
      </div>
      <div class="chips" role="radiogroup" aria-label=${this.label}>
        ${this.options.map(t=>W`
          <button class="chip ${t.value===this.selected?"on":""}" role="radio"
            aria-checked=${t.value===this.selected} ?disabled=${this.disabled}
            @click=${()=>this._select(t.value)}>${t.label}</button>`)}
      </div>`}};Zt.styles=r`
    :host { display: block; }
    .head { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 500;
      color: var(--secondary-text-color); margin: 0 2px 6px; text-transform: uppercase; letter-spacing: 0.04em; }
    .head ha-icon { --mdc-icon-size: 16px; }
    .chips { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; padding-bottom: 2px; }
    .chips::-webkit-scrollbar { display: none; }
    .chip {
      flex: 0 0 auto; border: none; border-radius: 999px; padding: 7px 14px; font: inherit; font-size: 13px;
      background: var(--hcc-chip-bg, rgba(127,127,127,0.12)); color: var(--primary-text-color);
      cursor: pointer; transition: background 0.2s, color 0.2s;
    }
    .chip:hover { background: rgba(127,127,127,0.2); }
    .chip.on { background: var(--hcc-accent, var(--primary-color)); color: var(--text-primary-color, #fff); }
    .chip:focus-visible { outline: 2px solid var(--hcc-accent, var(--primary-color)); outline-offset: 2px; }
    .chip:disabled { opacity: 0.5; cursor: default; }
    .dropdown-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .dropdown-row .head { margin: 0 2px; flex: none; }
    .select { position: relative; display: flex; align-items: center; min-width: 0; flex: 0 1 auto; }
    .select select {
      appearance: none; -webkit-appearance: none; border: none; border-radius: 999px; font: inherit; font-size: 13px;
      padding: 8px 34px 8px 14px; max-width: 100%; text-overflow: ellipsis; cursor: pointer;
      background: var(--hcc-accent, var(--primary-color)); color: var(--text-primary-color, #fff);
    }
    .select select option { color: var(--primary-text-color); background: var(--card-background-color, #fff); }
    .select select:focus-visible { outline: 2px solid var(--hcc-accent, var(--primary-color)); outline-offset: 2px; }
    .select select:disabled { opacity: 0.5; cursor: default; }
    .select ha-icon { position: absolute; right: 10px; pointer-events: none; --mdc-icon-size: 18px; color: var(--text-primary-color, #fff); }
  `,t([mt()],Zt.prototype,"label",void 0),t([mt()],Zt.prototype,"icon",void 0),t([mt()],Zt.prototype,"selected",void 0),t([mt({attribute:!1})],Zt.prototype,"options",void 0),t([mt({type:Boolean})],Zt.prototype,"disabled",void 0),t([mt({type:Number})],Zt.prototype,"dropdownThreshold",void 0),Zt=t([dt("hcc-attribute-select")],Zt);let Jt=class extends lt{constructor(){super(...arguments),this.items=[]}_open(t){t&&this.dispatchEvent(new CustomEvent("hass-more-info",{detail:{entityId:t},bubbles:!0,composed:!0}))}render(){return W`<div class="row">
      ${this.items.map(t=>W`
        <button class="item ${t.warning?"warn":""}" title=${t.label} @click=${()=>this._open(t.entity)}>
          <ha-icon .icon=${t.icon}></ha-icon>
          <div class="text"><span class="value">${t.value}</span><span class="label">${t.label}</span></div>
        </button>`)}
    </div>`}};Jt.styles=r`
    .row { display: grid; grid-template-columns: repeat(auto-fit, minmax(128px, 1fr)); gap: 8px; }
    .item {
      display: flex; align-items: center; gap: 8px; padding: 8px 10px; border: none; border-radius: 12px;
      background: var(--hcc-chip-bg, rgba(127,127,127,0.12)); color: var(--primary-text-color);
      font: inherit; text-align: left; cursor: pointer; min-width: 0;
    }
    .item:hover { background: rgba(127,127,127,0.2); }
    .item ha-icon { --mdc-icon-size: 20px; color: var(--secondary-text-color); flex: none; }
    .item.warn { background: color-mix(in srgb, var(--warning-color, #ff9800) 20%, transparent); }
    .item.warn ha-icon { color: var(--warning-color, #ff9800); }
    .text { display: flex; flex-direction: column; min-width: 0; }
    .value { font-size: 14px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .label { font-size: 11px; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  `,t([mt({attribute:!1})],Jt.prototype,"items",void 0),Jt=t([dt("hcc-sensor-row")],Jt);let Xt=class extends lt{constructor(){super(...arguments),this.hours=24,this.emptyText="",this.unit="",this._current=[],this._target=[],this._bands=[],this._loaded=!1,this._key=""}connectedCallback(){super.connectedCallback(),this._timer=window.setInterval(()=>this._fetch(),3e5)}disconnectedCallback(){super.disconnectedCallback(),clearInterval(this._timer)}updated(t){const e=`${this.entity}|${this.sensor}|${this.hours}`;this.hass&&e!==this._key&&(this._key=e,this._fetch()),super.updated(t)}async _fetch(){if(!this.hass||!this.entity)return;const t=new Date,e=new Date(t.getTime()-3600*this.hours*1e3),i=[this.entity,...this.sensor?[this.sensor]:[]];try{const s=await this.hass.callWS({type:"history/history_during_period",start_time:e.toISOString(),end_time:t.toISOString(),entity_ids:i,minimal_response:!1,no_attributes:!1,significant_changes_only:!1});this._parse(s,e.getTime(),t.getTime())}catch(t){console.warn("ha-climate-card: history fetch failed",t)}this._loaded=!0}_parse(t,e,i){const s=t[this.entity]??[],n=[],o=[],r=[];let a={};if(s.forEach((t,c)=>{t.a&&(a=t.a);const l=Math.max(1e3*t.lu,e),h=Number(a.current_temperature),d=Number(a.temperature??a.target_temp_high);!this.sensor&&Number.isFinite(h)&&n.push({t:l,v:h}),Number.isFinite(d)&&"off"!==t.s?o.push({t:l,v:d}):o.push({t:l,v:NaN});const p=Mt[a.hvac_action];if(p&&"off"!==t.s){const t=s[c+1]?1e3*s[c+1].lu:i;r.push({from:l,to:t,color:Tt[p]})}}),this.sensor){const i=this.sensor.startsWith("climate.");let s={};for(const o of t[this.sensor]??[]){o.a&&(s=o.a);const t=Number(i?s.current_temperature:o.s);Number.isFinite(t)&&n.push({t:Math.max(1e3*o.lu,e),v:t})}}n.length&&n.push({t:i,v:n[n.length-1].v}),o.length&&o.push({t:i,v:o[o.length-1].v}),this._current=n,this._target=o,this._bands=r}_path(t,e,i,s){let n,o="";for(const r of t)Number.isFinite(r.v)?(o+=n?s?`H ${e(r.t).toFixed(1)} V ${i(r.v).toFixed(1)} `:`L ${e(r.t).toFixed(1)} ${i(r.v).toFixed(1)} `:`M ${e(r.t).toFixed(1)} ${i(r.v).toFixed(1)} `,n=r):n=void 0;return o}render(){if(!this._loaded)return W`<div class="placeholder"></div>`;const t=[...this._current,...this._target].map(t=>t.v).filter(Number.isFinite);if(!t.length)return W`<div class="placeholder empty">${this.emptyText}</div>`;const e=Date.now(),i=e-3600*this.hours*1e3;let s=Math.min(...t),n=Math.max(...t);const o=s,r=n;if(n-s<2){const t=(n+s)/2;s=t-1,n=t+1}const a=.15*(n-s);s-=a,n+=a;const c=t=>(t-i)/(e-i)*300,l=t=>80-(t-s)/(n-s)*80,h=this._current[this._current.length-1];return W`
      <div class="graph">
        <svg viewBox="0 0 ${300} ${80}" preserveAspectRatio="none">
          ${this._bands.map(t=>V`<rect x=${c(t.from)} y="0" width=${Math.max(.5,c(t.to)-c(t.from))}
            height=${80} style="fill:${t.color}" class="band"></rect>`)}
          <path class="target" d=${this._path(this._target,c,l,!0)}></path>
          <path class="current" d=${this._path(this._current,c,l,!1)}></path>
        </svg>
        <div class="labels">
          <span>-${this.hours}h</span>
          <span>${o.toFixed(1)}–${r.toFixed(1)}${this.unit}</span>
          ${h?W`<span>${h.v.toFixed(1)}${this.unit}</span>`:q}
        </div>
      </div>`}};Xt.styles=r`
    :host { display: block; }
    .graph svg { width: 100%; height: 80px; display: block; overflow: visible; }
    .band { opacity: 0.14; }
    .current { fill: none; stroke: var(--hcc-accent, var(--primary-color)); stroke-width: 2; vector-effect: non-scaling-stroke; stroke-linejoin: round; }
    .target { fill: none; stroke: var(--secondary-text-color); stroke-width: 1.5; stroke-dasharray: 4 3; vector-effect: non-scaling-stroke; opacity: 0.7; }
    .labels { display: flex; justify-content: space-between; font-size: 11px; color: var(--secondary-text-color); margin-top: 4px; }
    .placeholder { height: 80px; border-radius: 12px; background: rgba(127,127,127,0.08); }
    .placeholder.empty { display: flex; align-items: center; justify-content: center; font-size: 12px; color: var(--secondary-text-color); }
  `,t([mt({attribute:!1})],Xt.prototype,"hass",void 0),t([mt()],Xt.prototype,"entity",void 0),t([mt()],Xt.prototype,"sensor",void 0),t([mt({type:Number})],Xt.prototype,"hours",void 0),t([mt()],Xt.prototype,"emptyText",void 0),t([mt()],Xt.prototype,"unit",void 0),t([_t()],Xt.prototype,"_current",void 0),t([_t()],Xt.prototype,"_target",void 0),t([_t()],Xt.prototype,"_bands",void 0),t([_t()],Xt.prototype,"_loaded",void 0),Xt=t([dt("hcc-history-graph")],Xt);const Yt=["switch","input_boolean","light","fan","automation","siren","humidifier"],Qt={switch:"mdi:toggle-switch-variant",input_boolean:"mdi:toggle-switch-variant",light:"mdi:lightbulb",fan:"mdi:fan",script:"mdi:script-text-play",scene:"mdi:palette",button:"mdi:gesture-tap-button",input_button:"mdi:gesture-tap-button",automation:"mdi:robot"},te=[[/licht|light|panel|display|led/i,"mdi:lightbulb-outline"],[/leise|quiet|silent/i,"mdi:volume-off"],[/frisch|fresh|air/i,"mdi:air-filter"],[/xfan|x-fan|zusatz|dry/i,"mdi:fan-plus"],[/health|ion|plasma/i,"mdi:shimmer"],[/turbo|boost|power/i,"mdi:rocket-launch-outline"],[/sleep|schlaf/i,"mdi:sleep"],[/timer/i,"mdi:timer-outline"]];let ee=class extends lt{constructor(){super(...arguments),this.items=[]}_activate(t){if(!this.hass)return;const e=t.entity.split(".")[0],i={entity_id:t.entity};Yt.includes(e)?this.hass.callService("homeassistant","toggle",i):"button"===e||"input_button"===e?this.hass.callService(e,"press",i):"script"===e||"scene"===e?this.hass.callService(e,"turn_on",i):this.hass.callService("homeassistant","toggle",i)}_moreInfo(t,e){t.preventDefault(),this.dispatchEvent(new CustomEvent("hass-more-info",{detail:{entityId:e},bubbles:!0,composed:!0}))}_icon(t,e){return!t.icon&&e&&customElements.get("ha-state-icon")?W`<ha-state-icon .hass=${this.hass} .stateObj=${e}></ha-state-icon>`:W`<ha-icon .icon=${t.icon??((t,e,i)=>{if(t?.attributes.icon)return t.attributes.icon;const s=te.find(([t])=>t.test(e)||t.test(i));return s?.[1]??Qt[e.split(".")[0]]??"mdi:gesture-tap"})(e,t.entity,t.name)}></ha-icon>`}render(){if(!this.hass||!this.items.length)return q;const t=this.hass.locale?.language??this.hass.language;return W`<div class="row" lang=${t}>
      ${this.items.map(t=>{const e=this.hass.states[t.entity],i="on"===e?.state,s=!e||"unavailable"===e.state;return W`<button class="sc ${i?"on":""}" ?disabled=${s} title=${t.name}
          aria-pressed=${Yt.includes(t.entity.split(".")[0])?String(i):q}
          @click=${()=>this._activate(t)} @contextmenu=${e=>this._moreInfo(e,t.entity)}>
          ${this._icon(t,e)}
          <span>${t.name}</span>
        </button>`})}
    </div>`}};ee.styles=r`
    .row { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 8px; }
    .sc {
      display: flex; align-items: center; gap: 10px; padding: 8px 10px; min-height: 48px; border: none; text-align: left;
      border-radius: 14px; background: var(--hcc-chip-bg, rgba(127,127,127,0.12)); color: var(--secondary-text-color);
      font: inherit; font-size: 13px; cursor: pointer; transition: background 0.2s, color 0.2s, transform 0.1s; min-width: 0;
    }
    .sc span { max-width: 100%; line-height: 1.25; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; -webkit-hyphens: auto; hyphens: auto; }
    .sc:hover { background: rgba(127,127,127,0.2); }
    .sc:active { transform: scale(0.95); }
    .sc.on { background: color-mix(in srgb, var(--hcc-accent, var(--primary-color)) 22%, transparent); color: var(--hcc-accent, var(--primary-color)); }
    .sc:focus-visible { outline: 2px solid var(--hcc-accent, var(--primary-color)); outline-offset: 2px; }
    .sc:disabled { opacity: 0.4; cursor: default; }
    ha-icon, ha-state-icon { --mdc-icon-size: 22px; flex: none; }
  `,t([mt({attribute:!1})],ee.prototype,"hass",void 0),t([mt({attribute:!1})],ee.prototype,"items",void 0),ee=t([dt("hcc-shortcut-row")],ee);const ie=t=>String(t).padStart(2,"0");let se=class extends lt{constructor(){super(...arguments),this.label="Sleeptimer",this.offText="Off",this.atText="Off at",this.inText="in",this._now=Date.now()}connectedCallback(){super.connectedCallback(),this._tick=window.setInterval(()=>this._now=Date.now(),3e4)}disconnectedCallback(){super.disconnectedCallback(),clearInterval(this._tick)}get _switch(){return this.switchEntity?this.hass?.states[this.switchEntity]:void 0}get _time(){return this.timeEntity?this.hass?.states[this.timeEntity]:void 0}_nextOff(){const t=this._time;if(!t)return;const e=t.attributes;if(e.has_date&&e.timestamp)return new Date(1e3*e.timestamp);if(null==e.hour||null==e.minute)return;const i=new Date(this._now);return i.setHours(e.hour,e.minute,e.second??0,0),i.getTime()<=this._now&&i.setDate(i.getDate()+1),i}_timeValue(){const t=this._time?.attributes;return null!=t?.hour?`${ie(t.hour)}:${ie(t.minute??0)}`:""}_remaining(t){const e=Math.max(0,Math.round((t.getTime()-this._now)/6e4)),i=Math.floor(e/60);return i?`${i}:${ie(e%60)} h`:`${e} min`}_toggle(){const t=this._switch;t&&this.hass&&this.hass.callService("homeassistant","on"===t.state?"turn_off":"turn_on",{entity_id:t.entity_id})}_setTime(t){const e=t.target.value,i=this._time;if(!e||!i||!this.hass)return;const s={entity_id:i.entity_id};if(i.attributes.has_date){const[t,i]=e.split(":").map(Number),n=new Date;n.setHours(t,i,0,0),n.getTime()<=Date.now()&&n.setDate(n.getDate()+1),s.datetime=`${n.getFullYear()}-${ie(n.getMonth()+1)}-${ie(n.getDate())} ${ie(t)}:${ie(i)}:00`}else s.time=`${e}:00`;this.hass.callService("input_datetime","set_datetime",s)}_moreInfo(t){t&&this.dispatchEvent(new CustomEvent("hass-more-info",{detail:{entityId:t},bubbles:!0,composed:!0}))}render(){if(!this.hass||!this._switch&&!this._time)return q;const t=!this._switch||"on"===this._switch.state,e=this._nextOff(),i=this._time?W`<input class="time" type="time" .value=${this._timeValue()} aria-label=${this.label} @change=${this._setTime} />`:q;return W`<div class="timer ${t?"armed":""}">
      <button class="badge" @click=${()=>this._moreInfo(this.switchEntity??this.timeEntity)} aria-label=${this.label}>
        <ha-icon icon=${t?"mdi:sleep":"mdi:sleep-off"}></ha-icon>
      </button>
      <div class="text">
        <span class="label">${this.label}</span>
        <span class="status">
          ${t?W`${this.atText} ${i}${e?W`<span class="remaining">· ${this.inText} ${this._remaining(e)}</span>`:q}`:W`${this.offText}${this._time?W` · ${i}`:q}`}
        </span>
      </div>
      ${this._switch?W`<button class="switch ${t?"on":""}" role="switch" aria-checked=${t}
        aria-label=${this.label} @click=${this._toggle}><span class="thumb"></span></button>`:q}
    </div>`}};se.styles=r`
    .timer {
      display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 14px;
      background: var(--hcc-chip-bg, rgba(127,127,127,0.12)); transition: background 0.3s;
      --timer-color: var(--hcc-timer-color, #7e57c2);
    }
    .timer.armed { background: color-mix(in srgb, var(--timer-color) 16%, transparent); }
    .badge { border: none; padding: 0; cursor: pointer; flex: none; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
      background: rgba(127,127,127,0.15); color: var(--secondary-text-color); }
    .armed .badge { background: var(--timer-color); color: #fff; }
    .badge ha-icon { --mdc-icon-size: 20px; }
    .text { display: flex; flex-direction: column; min-width: 0; flex: 1; gap: 2px; }
    .label { font-size: 14px; font-weight: 600; color: var(--primary-text-color); }
    .status { display: flex; align-items: center; flex-wrap: wrap; gap: 4px; font-size: 12px; color: var(--secondary-text-color); }
    .remaining { white-space: nowrap; }
    .time {
      font: inherit; font-size: 13px; font-weight: 600; color: var(--primary-text-color); cursor: pointer;
      background: var(--card-background-color, #fff); border: 1px solid var(--divider-color, rgba(127,127,127,0.3));
      border-radius: 8px; padding: 1px 4px; color-scheme: light dark;
    }
    .time::-webkit-calendar-picker-indicator { display: none; }
    .time:focus-visible { outline: 2px solid var(--timer-color); outline-offset: 1px; }
    .switch { flex: none; position: relative; width: 44px; height: 26px; border-radius: 13px; border: none; cursor: pointer;
      background: rgba(127,127,127,0.35); transition: background 0.2s; padding: 0; }
    .switch.on { background: var(--timer-color); }
    .thumb { position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: 50%; background: #fff;
      box-shadow: 0 1px 2px rgba(0,0,0,0.3); transition: transform 0.2s; }
    .switch.on .thumb { transform: translateX(18px); }
    .switch:focus-visible { outline: 2px solid var(--timer-color); outline-offset: 2px; }
  `,t([mt({attribute:!1})],se.prototype,"hass",void 0),t([mt()],se.prototype,"switchEntity",void 0),t([mt()],se.prototype,"timeEntity",void 0),t([mt()],se.prototype,"label",void 0),t([mt()],se.prototype,"offText",void 0),t([mt()],se.prototype,"atText",void 0),t([mt()],se.prototype,"inText",void 0),t([_t()],se.prototype,"_now",void 0),se=t([dt("hcc-sleep-timer")],se);const ne=["unavailable","unknown"],oe=t=>{if("off"===t.state||ne.includes(t.state))return Tt.off;const e=Mt[t.attributes.hvac_action];return Tt[e??t.state]??"var(--primary-color)"},re=t=>{const e=t.attributes.hvac_action;return"off"!==t.state&&!ne.includes(t.state)&&(!e||!["idle","off"].includes(e))},ae=t=>{const e=null==t||""===t?NaN:Number(t);return Number.isFinite(e)?e:void 0},ce=t=>{if(!t||ne.includes(t.state))return;const e=t.entity_id.split(".")[0];return ae("climate"===e?t.attributes.current_temperature:"weather"===e?t.attributes.temperature:t.state)},le=(t,e,i="°C")=>{if(e<=0||e>100)return;const s="°F"===i?5*(t-32)/9:t,n=243.12,o=Math.log(e/100)+17.62*s/(n+s),r=n*o/(17.62-o);return"°F"===i?9*r/5+32:r},he={"clear-night":"mdi:weather-night",cloudy:"mdi:weather-cloudy",exceptional:"mdi:alert-circle-outline",fog:"mdi:weather-fog",hail:"mdi:weather-hail",lightning:"mdi:weather-lightning","lightning-rainy":"mdi:weather-lightning-rainy",partlycloudy:"mdi:weather-partly-cloudy",pouring:"mdi:weather-pouring",rainy:"mdi:weather-rainy",snowy:"mdi:weather-snowy","snowy-rainy":"mdi:weather-snowy-rainy",sunny:"mdi:weather-sunny",windy:"mdi:weather-windy","windy-variant":"mdi:weather-windy-variant"},de=t=>{if(!t)return 0;const e=t.split(":").map(Number);for(;e.length<3;)e.unshift(0);return 3600*e[0]+60*e[1]+e[2]},pe=t=>{const e=t=>String(Math.floor(t)).padStart(2,"0");return`${e(t/3600)}:${e(t%3600/60)}:${e(t%60)}`};let ue=class extends lt{constructor(){super(...arguments),this.durations=[30,60,90,120],this.label="Off in",this.cancelText="Cancel",this._now=Date.now()}get _timer(){return this.entity?this.hass?.states[this.entity]:void 0}disconnectedCallback(){super.disconnectedCallback(),clearInterval(this._tick),this._tick=void 0}updated(){const t="active"===this._timer?.state;t&&!this._tick&&(this._tick=window.setInterval(()=>this._now=Date.now(),1e3)),!t&&this._tick&&(clearInterval(this._tick),this._tick=void 0)}_remaining(t){return"active"===t.state&&t.attributes.finishes_at?Math.max(0,(new Date(t.attributes.finishes_at).getTime()-this._now)/1e3):de(t.attributes.remaining)}_start(t){this.hass&&this.entity&&this.hass.callService("timer","start",{entity_id:this.entity,duration:pe(60*t)})}_cancel(){this.hass&&this.entity&&this.hass.callService("timer","cancel",{entity_id:this.entity})}_fmtChip(t){if(t<60)return`${t} min`;const e=t/60;return`${Number.isInteger(e)?e:e.toFixed(1).replace(".",",")} h`}_fmtRemaining(t){const e=Math.round(t),i=Math.floor(e/3600),s=Math.floor(e%3600/60),n=String(e%60).padStart(2,"0");return i?`${i}:${String(s).padStart(2,"0")}:${n}`:`${s}:${n}`}render(){const t=this._timer;if(!t)return q;const e="active"===t.state||"paused"===t.state,i=e?this._remaining(t):0,s=de(t.attributes.duration)||1,n=e?Math.min(100,i/s*100):0;return W`<div class="countdown ${e?"running":""}">
      <div class="head">
        <span class="title"><ha-icon icon="mdi:timer-outline"></ha-icon>${this.label}</span>
        ${e?W`<span class="remaining">${this._fmtRemaining(i)}</span>
          <button class="cancel" @click=${this._cancel} aria-label=${this.cancelText} title=${this.cancelText}>
            <ha-icon icon="mdi:close"></ha-icon></button>`:q}
      </div>
      ${e?W`<div class="bar"><div style="width:${n}%"></div></div>`:q}
      <div class="chips">
        ${this.durations.map(t=>W`<button class="chip" @click=${()=>this._start(t)}>${this._fmtChip(t)}</button>`)}
      </div>
    </div>`}};ue.styles=r`
    .countdown { display: flex; flex-direction: column; gap: 8px; padding: 10px 12px; border-radius: 14px;
      background: var(--hcc-chip-bg, rgba(127,127,127,0.12)); --c: var(--hcc-timer-color, #7e57c2); }
    .countdown.running { background: color-mix(in srgb, var(--c) 16%, transparent); }
    .head { display: flex; align-items: center; gap: 8px; min-height: 24px; }
    .title { display: flex; align-items: center; gap: 6px; flex: 1; font-size: 12px; font-weight: 500;
      color: var(--secondary-text-color); text-transform: uppercase; letter-spacing: 0.04em; }
    .title ha-icon { --mdc-icon-size: 16px; }
    .remaining { font-size: 18px; font-weight: 600; font-variant-numeric: tabular-nums; color: var(--primary-text-color); }
    .cancel { border: none; background: rgba(127,127,127,0.18); color: var(--primary-text-color); width: 26px; height: 26px;
      border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0; }
    .cancel ha-icon { --mdc-icon-size: 16px; }
    .bar { height: 4px; border-radius: 2px; background: rgba(127,127,127,0.2); overflow: hidden; }
    .bar div { height: 100%; background: var(--c); transition: width 1s linear; }
    .chips { display: flex; gap: 6px; }
    .chip { flex: 1; border: none; border-radius: 999px; padding: 6px 4px; font: inherit; font-size: 13px; cursor: pointer;
      background: var(--card-background-color, #fff); color: var(--primary-text-color); transition: background 0.2s; }
    .chip:hover { background: color-mix(in srgb, var(--c) 20%, var(--card-background-color, #fff)); }
    .chip:focus-visible, .cancel:focus-visible { outline: 2px solid var(--c); outline-offset: 2px; }
  `,t([mt({attribute:!1})],ue.prototype,"hass",void 0),t([mt()],ue.prototype,"entity",void 0),t([mt({attribute:!1})],ue.prototype,"durations",void 0),t([mt()],ue.prototype,"label",void 0),t([mt()],ue.prototype,"cancelText",void 0),t([_t()],ue.prototype,"_now",void 0),ue=t([dt("hcc-countdown-timer")],ue);let me=class extends lt{constructor(){super(...arguments),this.speed=.5,this.swingVertical=!1,this.swingHorizontal=!1,this.color="var(--primary-color)"}render(){const t=(2.8-2*this.speed).toFixed(2);return W`<svg viewBox="0 0 300 110" preserveAspectRatio="none"
      class="${this.swingVertical?"sv":""} ${this.swingHorizontal?"sh":""}"
      style="--d:${t}s;--c:${this.color}">
      <g class="fan">
        ${[-75,-50,-25,0,25,50,75].map((t,e)=>{const i=150+t,s=150+1.5*t;return V`<path d=${`M ${i} 0 C ${i+.15*t} 40, ${s-.1*t} 75, ${s} 110`} style="animation-delay:-${(.37*e).toFixed(2)}s"></path>`})}
      </g>
    </svg>`}};me.styles=r`
    :host { position: absolute; inset: 0 0 auto 0; height: 34%; pointer-events: none; z-index: -1; overflow: hidden;
      -webkit-mask-image: linear-gradient(to bottom, rgba(0,0,0,0.9) 0%, transparent 90%); mask-image: linear-gradient(to bottom, rgba(0,0,0,0.9) 0%, transparent 90%); }
    svg { width: 100%; height: 100%; display: block; }
    path { fill: none; stroke: var(--c); stroke-opacity: 0.22; stroke-width: 1.5; stroke-linecap: round;
      vector-effect: non-scaling-stroke; stroke-dasharray: 6 34; animation: flow var(--d) linear infinite; }
    .fan { transform-origin: 150px 0; transform-box: view-box; }
    path { transform: translateZ(0); }
    .sv .fan { animation: sv 6s ease-in-out infinite; }
    .sh .fan { animation: sh 7s ease-in-out infinite; }
    .sv.sh .fan { animation: sv 6s ease-in-out infinite, sh 7s ease-in-out infinite; }
    @keyframes flow { from { stroke-dashoffset: 40; } to { stroke-dashoffset: 0; } }
    @keyframes sv { 0%, 100% { scale: 1 0.75; } 50% { scale: 1 1.15; } }
    @keyframes sh { 0%, 100% { rotate: -8deg; } 50% { rotate: 8deg; } }
    @media (prefers-reduced-motion: reduce) { path, .fan { animation: none !important; } }
  `,t([mt({type:Number})],me.prototype,"speed",void 0),t([mt({type:Boolean})],me.prototype,"swingVertical",void 0),t([mt({type:Boolean})],me.prototype,"swingHorizontal",void 0),t([mt()],me.prototype,"color",void 0),me=t([dt("hcc-airflow")],me);const _e=(t,e)=>({name:t,selector:{entity:{filter:e}}});let fe=class extends lt{constructor(){super(...arguments),this._computeLabel=t=>t.name in zt?this._t(`show_${t.name}`):this._t(t.name)}setConfig(t){this._config=t}_t(t){return Ut(this.hass,`editor.${t}`)}_schema(){return[{name:"entity",required:!0,selector:{entity:{domain:"climate"}}},{type:"grid",name:"",schema:[{name:"name",selector:{text:{}}},{name:"icon",selector:{icon:{}}}]},{name:"layout",selector:{select:{mode:"box",options:[{value:"full",label:this._t("layout_full")},{value:"compact",label:this._t("layout_compact")}]}}},{type:"expandable",name:"show",title:this._t("sections"),icon:"mdi:eye-outline",schema:[{type:"grid",name:"",schema:Object.keys(zt).map(t=>({name:t,selector:{boolean:{}}}))}]},{type:"expandable",name:"",flatten:!0,title:this._t("sensors"),icon:"mdi:thermometer-lines",schema:[{name:"temperature_sensor",selector:{entity:{filter:[{domain:"sensor",device_class:"temperature"},{domain:"climate"}]}}},{name:"use_sensor_for_current",selector:{boolean:{}}},_e("humidity_sensor",{domain:"sensor",device_class:"humidity"}),_e("outdoor_sensor",{domain:["sensor","weather"]}),_e("power_sensor",{domain:"sensor",device_class:"power"}),_e("energy_sensor",{domain:"sensor",device_class:"energy"}),_e("window_sensor",{domain:"binary_sensor"})]},{type:"expandable",name:"",flatten:!0,title:this._t("hints_section"),icon:"mdi:weather-partly-cloudy",schema:[{name:"weather_entity",selector:{entity:{filter:{domain:"weather"}}}},{name:"ventilation_delta",selector:{number:{min:1,max:15,step:.5,mode:"box",unit_of_measurement:"°"}}},{name:"humidity_warning",selector:{number:{min:0,max:100,step:1,mode:"box",unit_of_measurement:"%"}}}]},{type:"expandable",name:"",flatten:!0,title:this._t("timer_section"),icon:"mdi:sleep",schema:[{name:"timer_switch",selector:{entity:{filter:{domain:["input_boolean","switch"]}}}},{name:"timer_time",selector:{entity:{filter:{domain:"input_datetime"}}}},{name:"countdown_timer",selector:{entity:{filter:{domain:"timer"}}}},{name:"countdown_durations",selector:{text:{}}}]},{type:"expandable",name:"",flatten:!0,title:this._t("shortcuts_section"),icon:"mdi:gesture-tap-button",schema:[{name:"auto_shortcuts",selector:{boolean:{}}},{name:"shortcuts",selector:{entity:{multiple:!0,filter:{domain:["switch","input_boolean","light","fan","script","scene","button","input_button","automation"]}}}}]},{type:"expandable",name:"",flatten:!0,title:this._t("appearance"),icon:"mdi:palette-outline",schema:[{name:"expandable",selector:{boolean:{}}},{name:"start_expanded",selector:{boolean:{}}},{name:"dropdown_threshold",selector:{number:{min:0,max:20,step:1,mode:"box"}}},{name:"graph_hours",selector:{number:{min:1,max:168,step:1,mode:"box",unit_of_measurement:"h"}}}]}]}_valueChanged(t){const e={...t.detail.value};if("string"==typeof e.countdown_durations){const t=e.countdown_durations.split(/[,; ]+/).map(Number).filter(t=>t>0);e.countdown_durations=t.length?t:void 0}const i=e;if(Array.isArray(i.shortcuts)){const t=this._config?.shortcuts??[];i.shortcuts=i.shortcuts.map(e=>{const i="string"==typeof e?e:e.entity;return t.find(t=>"string"!=typeof t&&t.entity===i)??i})}for(const t of Object.keys(i)){const e=i[t];(""===e||null==e||Array.isArray(e)&&!e.length)&&delete i[t]}this._config=i,this.dispatchEvent(new CustomEvent("config-changed",{detail:{config:i},bubbles:!0,composed:!0}))}render(){if(!this.hass||!this._config)return q;const t={layout:"full",graph_hours:24,auto_shortcuts:!0,use_sensor_for_current:!0,expandable:!0,dropdown_threshold:6,ventilation_delta:3,humidity_warning:70,...this._config,shortcuts:this._config.shortcuts?.map(t=>"string"==typeof t?t:t.entity),countdown_durations:this._config.countdown_durations?.join(", "),show:{...zt,...this._config.show??{}}};return W`<ha-form .hass=${this.hass} .data=${t} .schema=${this._schema()}
      .computeLabel=${this._computeLabel} @value-changed=${this._valueChanged}></ha-form>`}};fe.styles=r`:host { display: block; }`,t([mt({attribute:!1})],fe.prototype,"hass",void 0),t([_t()],fe.prototype,"_config",void 0),fe=t([dt("ha-climate-card-editor")],fe),window.customCards=window.customCards||[],window.customCards.push({type:"ha-climate-overview-card",name:"HA Climate Overview",description:"Alle Klimaanlagen auf einen Blick – mit Temperatur, Schnellregelung und „Alle aus“.",preview:!0,documentationURL:"https://github.com/passi277/HA_Climate_Card"});let ge=class extends lt{constructor(){super(...arguments),this._pending={},this._timers={}}static getConfigElement(){return document.createElement("ha-climate-overview-card-editor")}static getStubConfig(t){return{entities:Object.keys(t.states).filter(t=>t.startsWith("climate.")).slice(0,3)}}setConfig(t){if(!Array.isArray(t?.entities)||!t.entities.length)throw new Error("ha-climate-overview-card: 'entities' (Liste von climate-Entitäten) fehlt");this._config={show_all_off:!0,show_controls:!0,...t}}getCardSize(){return 1+(this._config?.entities.length??1)}getGridOptions(){return{columns:12,min_columns:6,rows:"auto"}}get _entities(){return(this._config?.entities??[]).map(t=>"string"==typeof t?{entity:t}:t)}shouldUpdate(t){if(!t.has("hass")||t.size>1)return!0;const e=t.get("hass");return!e||this._entities.some(t=>e.states[t.entity]!==this.hass.states[t.entity])}updated(t){if(super.updated(t),!t.has("hass"))return;const e=t.get("hass");for(const t of Object.keys(this._pending))if(e&&e.states[t]!==this.hass.states[t]){const{[t]:e,...i}=this._pending;this._pending=i}}_t(t){return Ut(this.hass,t)}_unit(){return this.hass?.config?.unit_system?.temperature??"°C"}_step(t){return Number(t.attributes.target_temp_step)||("°F"===this._unit()?1:.5)}_fmt(t,e){return null==t?"–":t.toFixed(e<1?1:0)}_stepTarget(t,e){const i=this._step(t),s=t.attributes,n=this._pending[t.entity_id]??Number(s.temperature);if(!Number.isFinite(n))return;const o=Math.min(Number(s.max_temp??35),Math.max(Number(s.min_temp??7),n+e*i));this._pending={...this._pending,[t.entity_id]:Number(o.toFixed(i<1?1:0))},clearTimeout(this._timers[t.entity_id]),this._timers[t.entity_id]=window.setTimeout(()=>{this.hass.callService("climate","set_temperature",{entity_id:t.entity_id,temperature:this._pending[t.entity_id]})},1e3)}_togglePower(t){const e=t.attributes;if("off"===t.state)if(At(e,$t))this.hass.callService("climate","turn_on",{entity_id:t.entity_id});else{const i=e.hvac_modes?.find(t=>"off"!==t);i&&this.hass.callService("climate","set_hvac_mode",{entity_id:t.entity_id,hvac_mode:i})}else At(e,xt)?this.hass.callService("climate","turn_off",{entity_id:t.entity_id}):this.hass.callService("climate","set_hvac_mode",{entity_id:t.entity_id,hvac_mode:"off"})}_allOff(t){for(const e of t){const t=this.hass.states[e];At(t.attributes,xt)?this.hass.callService("climate","turn_off",{entity_id:e}):this.hass.callService("climate","set_hvac_mode",{entity_id:e,hvac_mode:"off"})}}_moreInfo(t){this.dispatchEvent(new CustomEvent("hass-more-info",{detail:{entityId:t},bubbles:!0,composed:!0}))}_renderRow(t){const e=this.hass.states[t.entity];if(!e)return W`<div class="row missing">${this._t("card.entity_not_found")}: ${t.entity}</div>`;const i=e.attributes,s=oe(e),n="off"===e.state,o=ne.includes(e.state),r=this._step(e),a=ce(e),c=this._pending[e.entity_id]??(null!=i.temperature?Number(i.temperature):void 0),l=null!=i.target_temp_low&&null!=i.target_temp_high&&null==i.temperature,h=i.hvac_action,d=o?this._t("card.unavailable"):h?Lt(this.hass,e,"hvac_action",h):It(this.hass,e,e.state),p=t.name??i.friendly_name??e.entity_id,u=re(e)&&!!h;return W`<div class="row ${n?"off":""}" style="--accent:${s}">
      <button class="info" @click=${()=>this._moreInfo(e.entity_id)}>
        <span class="badge ${u?"active":""}">
          <ha-icon .icon=${Et[h??""]??Ct[e.state]??"mdi:air-conditioner"}></ha-icon>
        </span>
        <span class="names">
          <span class="name">${p}</span>
          <span class="status">${d}${null!=a?W` · <ha-icon icon="mdi:home-thermometer-outline"></ha-icon>${this._fmt(a,r)}°`:q}</span>
        </span>
      </button>
      ${!this._config.show_controls||n||o?q:l?W`<span class="target">${this._fmt(Number(i.target_temp_low),r)}–${this._fmt(Number(i.target_temp_high),r)}°</span>`:null!=c?W`<div class="stepper">
              <button aria-label="-" @click=${()=>this._stepTarget(e,-1)}><ha-icon icon="mdi:minus"></ha-icon></button>
              <span class="target">${this._fmt(c,r)}°</span>
              <button aria-label="+" @click=${()=>this._stepTarget(e,1)}><ha-icon icon="mdi:plus"></ha-icon></button>
            </div>`:q}
      <button class="power ${n?"":"on"}" ?disabled=${o} @click=${()=>this._togglePower(e)}
        aria-label=${this._t(n?"card.turn_on":"card.turn_off")} title=${this._t(n?"card.turn_on":"card.turn_off")}>
        <ha-icon icon="mdi:power"></ha-icon>
      </button>
    </div>`}render(){if(!this._config||!this.hass)return q;const t=this._entities.map(t=>t.entity).filter(t=>this.hass.states[t]),e=t.filter(t=>!["off",...ne].includes(this.hass.states[t].state));return W`<ha-card>
      <div class="header">
        <div class="titles">
          <span class="title">${this._config.title??this._t("overview.title")}</span>
          <span class="sub">${e.length} ${this._t("overview.of")} ${t.length} ${this._t("overview.running")}</span>
        </div>
        ${this._config.show_all_off?W`<button class="all-off" ?disabled=${!e.length} @click=${()=>this._allOff(e)}>
          <ha-icon icon="mdi:power"></ha-icon>${this._t("overview.all_off")}</button>`:q}
      </div>
      <div class="rows">${this._entities.map(t=>this._renderRow(t))}</div>
    </ha-card>`}};ge.styles=r`
    ha-card { padding: 16px; display: flex; flex-direction: column; gap: 12px; box-sizing: border-box; height: 100%; }
    button { font: inherit; color: inherit; }
    .header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .titles { display: flex; flex-direction: column; min-width: 0; }
    .title { font-size: 16px; font-weight: 600; }
    .sub { font-size: 13px; color: var(--secondary-text-color); }
    .all-off { display: flex; align-items: center; gap: 6px; border: none; border-radius: 999px; padding: 8px 14px; cursor: pointer;
      background: rgba(127,127,127,0.14); font-size: 13px; font-weight: 600; }
    .all-off:hover:not(:disabled) { background: color-mix(in srgb, var(--error-color, #db4437) 18%, transparent); color: var(--error-color, #db4437); }
    .all-off:disabled { opacity: 0.4; cursor: default; }
    .all-off ha-icon { --mdc-icon-size: 18px; }
    .rows { display: flex; flex-direction: column; gap: 8px; }
    .row { display: flex; align-items: center; gap: 8px; padding: 8px; border-radius: 16px;
      background: color-mix(in srgb, var(--accent) 10%, rgba(127,127,127,0.06)); transition: background 0.3s; }
    .row.off { background: rgba(127,127,127,0.08); }
    .row.missing { color: var(--error-color, #db4437); font-size: 13px; }
    .info { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; background: none; border: none; padding: 0;
      cursor: pointer; text-align: left; }
    .badge { flex: none; width: 38px; height: 38px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
      background: color-mix(in srgb, var(--accent) 22%, transparent); color: var(--accent); }
    .badge.active ha-icon { animation: breathe 2.4s ease-in-out infinite; }
    .names { display: flex; flex-direction: column; min-width: 0; }
    .name { font-size: 14px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .status { display: flex; align-items: center; gap: 2px; font-size: 12px; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; }
    .status ha-icon { --mdc-icon-size: 14px; }
    .stepper { display: flex; align-items: center; gap: 2px; background: var(--card-background-color, #fff); border-radius: 999px; padding: 2px; }
    .stepper button { width: 30px; height: 30px; border: none; border-radius: 50%; background: transparent; cursor: pointer;
      color: var(--accent); display: flex; align-items: center; justify-content: center; padding: 0; }
    .stepper button:hover { background: color-mix(in srgb, var(--accent) 18%, transparent); }
    .stepper ha-icon { --mdc-icon-size: 18px; }
    .target { min-width: 40px; text-align: center; font-size: 16px; font-weight: 600; font-variant-numeric: tabular-nums; }
    .power { flex: none; width: 38px; height: 38px; border-radius: 50%; border: none; cursor: pointer; padding: 0;
      background: rgba(127,127,127,0.14); color: var(--secondary-text-color); display: flex; align-items: center; justify-content: center; }
    .power.on { background: var(--accent); color: var(--text-primary-color, #fff); }
    .power:disabled { opacity: 0.4; cursor: default; }
    .power ha-icon { --mdc-icon-size: 20px; }
    @keyframes breathe { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.12); } }
    @media (prefers-reduced-motion: reduce) { .badge.active ha-icon { animation: none; } }
  `,t([mt({attribute:!1})],ge.prototype,"hass",void 0),t([_t()],ge.prototype,"_config",void 0),t([_t()],ge.prototype,"_pending",void 0),ge=t([dt("ha-climate-overview-card")],ge);let be=class extends lt{constructor(){super(...arguments),this._schema=[{name:"title",selector:{text:{}}},{name:"entities",required:!0,selector:{entity:{multiple:!0,filter:{domain:"climate"}}}},{type:"grid",name:"",schema:[{name:"show_all_off",selector:{boolean:{}}},{name:"show_controls",selector:{boolean:{}}}]}],this._computeLabel=t=>Ut(this.hass,`overview.editor_${t.name}`)}setConfig(t){this._config=t}_valueChanged(t){const e={...t.detail.value},i=this._config?.entities??[];e.entities=(e.entities??[]).map(t=>i.find(e=>"string"!=typeof e&&e.entity===t)??t),e.title||delete e.title,this._config=e,this.dispatchEvent(new CustomEvent("config-changed",{detail:{config:e},bubbles:!0,composed:!0}))}render(){if(!this.hass||!this._config)return q;const t={show_all_off:!0,show_controls:!0,...this._config,entities:(this._config.entities??[]).map(t=>"string"==typeof t?t:t.entity)};return W`<ha-form .hass=${this.hass} .data=${t} .schema=${this._schema}
      .computeLabel=${this._computeLabel} @value-changed=${this._valueChanged}></ha-form>`}};t([mt({attribute:!1})],be.prototype,"hass",void 0),t([_t()],be.prototype,"_config",void 0),be=t([dt("ha-climate-overview-card-editor")],be);const ye=["unavailable","unknown"];console.info("%c HA-CLIMATE-CARD %c v1.0.0 ","color:#fff;background:#2196f3;font-weight:700;border-radius:4px 0 0 4px","color:#2196f3;background:#fff;font-weight:700;border-radius:0 4px 4px 0"),window.customCards=window.customCards||[],window.customCards.push({type:"ha-climate-card",name:"HA Climate Card",description:"Moderne Karte für Klimaanlagen mit Drehregler, allen Modi, Sensoren und Verlauf.",preview:!0,documentationURL:"https://github.com/passi277/HA_Climate_Card"});let ve=class extends lt{constructor(){super(...arguments),this._expanded=!1}static getConfigElement(){return document.createElement("ha-climate-card-editor")}static getStubConfig(t){return{entity:Object.keys(t.states).find(t=>t.startsWith("climate."))??"",layout:"full"}}setConfig(t){if(!t?.entity||!t.entity.startsWith("climate."))throw new Error("ha-climate-card: 'entity' muss eine climate-Entität sein (climate.xyz)");const e=this._config?.start_expanded!==t.start_expanded;this._config={layout:"full",graph_hours:24,...t},e&&(this._expanded=!!t.start_expanded)}getCardSize(){return"compact"===this._config?.layout?this._expanded?6:2:!1===this._config?.expandable||this._expanded?this._show.graph?10:8:6}getGridOptions(){return{columns:6,min_columns:4,rows:"auto"}}get _show(){return{...zt,...this._config?.show??{}}}get _stateObj(){return this._config&&this.hass?.states[this._config.entity]}shouldUpdate(t){if(!t.has("hass")||t.size>1)return!0;const e=t.get("hass");if(!e||!this._config)return!0;return[this._config.entity,this._config.temperature_sensor,this._config.humidity_sensor,this._config.outdoor_sensor,this._config.power_sensor,this._config.energy_sensor,this._config.window_sensor,this._config.timer_switch,this._config.timer_time,this._config.countdown_timer,this._config.weather_entity,...this._shortcutIds()].filter(Boolean).some(t=>e.states[t]!==this.hass.states[t])||e.locale!==this.hass.locale}updated(t){super.updated(t),(t.has("hass")||t.has("_config"))&&this._subscribeWeather();const e=this._stateObj;e&&this._sentAt&&e.last_updated!==this._sentAt&&(this._sentAt=void 0,this._pending=void 0,this._pendingHumidity=void 0)}connectedCallback(){super.connectedCallback(),this.hass&&this._subscribeWeather()}disconnectedCallback(){super.disconnectedCallback(),this._unsubscribeWeather(),clearTimeout(this._tempTimer),clearTimeout(this._humTimer),clearTimeout(this._clearTimer)}_t(t){return Ut(this.hass,t)}get _unit(){return this.hass?.config?.unit_system?.temperature??"°C"}_step(t){return Number(t.attributes.target_temp_step)||("°F"===this._unit?1:.5)}_fmt(t,e=.5){return null!=t&&Number.isFinite(Number(t))?Number(t).toFixed(e<1?1:0):"–"}_isDual(t){const e=t.attributes;return At(e,gt)&&null!=e.target_temp_low&&null!=e.target_temp_high&&(null==e.temperature||!At(e,ft))}_modeColor(t){return oe(t)}_isActive(t){return!!t.attributes.hvac_action&&re(t)}_unsubscribeWeather(){this._weatherUnsub?.then(t=>t()).catch(()=>{}),this._weatherUnsub=void 0,this._weatherKey=void 0}_subscribeWeather(){const t=this._config?.weather_entity;if(!t||!this.hass||!this.isConnected)return void(this._weatherKey&&this._unsubscribeWeather());if(this._weatherKey===t)return;this._unsubscribeWeather(),this._weatherKey=t;const e=this.hass.states[t]?.attributes.forecast;e?.length&&(this._forecast=e[0]),this.hass.connection&&(this._weatherUnsub=this.hass.connection.subscribeMessage(t=>{t.forecast?.length&&(this._forecast=t.forecast[0])},{type:"weather/subscribe_forecast",forecast_type:"daily",entity_id:t}),this._weatherUnsub.catch(()=>{this._weatherUnsub=this.hass?.connection?.subscribeMessage(t=>{if(!t.forecast?.length)return;const e=t.forecast.slice(0,24).map(t=>t.temperature).filter(t=>null!=t);this._forecast={condition:t.forecast[0].condition,temperature:Math.max(...e),templow:Math.min(...e)}},{type:"weather/subscribe_forecast",forecast_type:"hourly",entity_id:t}),this._weatherUnsub?.catch(()=>{})}))}_outdoorTemp(){const t=this._config;return(t.outdoor_sensor?ce(this.hass.states[t.outdoor_sensor]):void 0)??(t.weather_entity?ce(this.hass.states[t.weather_entity]):void 0)}get _externalTemp(){const t=this._config;if(t?.temperature_sensor&&!1!==t.use_sensor_for_current)return this.hass?.states[t.temperature_sensor]}_tempOf(t){if(!t)return;const e=t.entity_id.startsWith("climate.")?t.attributes.current_temperature:t.state,i=null==e||""===e?NaN:Number(e);return Number.isFinite(i)?i:void 0}_currentTemp(t){return this._tempOf(this._externalTemp)??this._tempOf(t)}_currentHumidity(t){const e=this._config,i=[e?.humidity_sensor?this.hass?.states[e.humidity_sensor]?.state:void 0,this._externalTemp?.attributes.current_humidity,t.attributes.current_humidity];for(const t of i){const e=null==t||""===t?NaN:Number(t);if(Number.isFinite(e))return e}}_targets(t){const e=t.attributes;return{value:this._pending?.value??(null!=e.temperature?Number(e.temperature):void 0),low:this._pending?.low??(null!=e.target_temp_low?Number(e.target_temp_low):void 0),high:this._pending?.high??(null!=e.target_temp_high?Number(e.target_temp_high):void 0)}}_sensorState(t){if(!t||!this.hass)return;const e=this.hass.states[t];if(!e)return;if(ye.includes(e.state))return"–";if(t.startsWith("weather.")||t.startsWith("climate.")){const t=ce(e);return null!=t?`${t} ${e.attributes.temperature_unit??this._unit}`:"–"}if(this.hass.formatEntityState)return this.hass.formatEntityState(e);const i=e.attributes.unit_of_measurement;return i?`${e.state} ${i}`:e.state}_windowOpen(){const t=this._config?.window_sensor;return!!t&&"on"===this.hass?.states[t]?.state}_autoShortcutIds(){const t=this.hass,e=this._config?.entity;if(!t?.entities||!e)return[];const i=this._autoShortcutCache;if(i&&i.key===t.entities&&i.device===e)return i.ids;const s=t.entities[e]?.device_id,n=s?Object.values(t.entities).filter(t=>t.device_id===s&&t.entity_id!==e&&!t.hidden&&Ht.includes(t.entity_id.split(".")[0])).map(t=>t.entity_id).sort():[];return this._autoShortcutCache={key:t.entities,device:e,ids:n},n}_shortcutIds(){const t=this._config;return t?t.shortcuts?t.shortcuts.map(t=>"string"==typeof t?t:t.entity):!1===t.auto_shortcuts?[]:this._autoShortcutIds():[]}_shortName(t,e){const i=this.hass.states[t]?.attributes.friendly_name??t.split(".")[1],s=this.hass.entities?.[t]?.device_id,n=s?this.hass.devices?.[s]:void 0,o=[n?.name_by_user,n?.name,e.attributes.friendly_name,this._config?.name].filter(t=>!!t).sort((t,e)=>e.length-t.length);for(const t of o)if(i.toLowerCase().startsWith(t.toLowerCase()+" "))return i.slice(t.length+1);return i}_shortcutItems(t){const e=this._config;return(e.shortcuts??(!1===e.auto_shortcuts?[]:this._autoShortcutIds())).map(t=>"string"==typeof t?{entity:t}:t).filter(t=>t?.entity&&this.hass.states[t.entity]).map(e=>({entity:e.entity,name:e.name??this._shortName(e.entity,t),icon:e.icon}))}_call(t,e={}){const i=this._stateObj;i&&this.hass&&(this._sentAt=i.last_updated,this.hass.callService("climate",t,{entity_id:i.entity_id,...e}).catch(t=>{console.error("ha-climate-card:",t),this._pending=void 0,this._pendingHumidity=void 0}),clearTimeout(this._clearTimer),this._clearTimer=window.setTimeout(()=>{this._pending=void 0,this._pendingHumidity=void 0,this._sentAt=void 0},6e3))}_scheduleTemp(t){clearTimeout(this._tempTimer),this._tempTimer=window.setTimeout(()=>{const t=this._stateObj,e=this._pending;t&&e&&(this._isDual(t)?this._call("set_temperature",{target_temp_low:e.low,target_temp_high:e.high}):null!=e.value&&this._call("set_temperature",{temperature:e.value}))},t)}_onDialChanging(t){clearTimeout(this._tempTimer),this._pending={...t.detail}}_onDialChanged(t){this._pending={...t.detail},this._scheduleTemp(400)}_stepTarget(t,e){const i=this._stateObj;if(!i)return;const s=this._step(i),n=Number(i.attributes.min_temp??7),o=Number(i.attributes.max_temp??35),r=this._targets(i),a=r[t]??this._currentTemp(i)??n;let c=Math.min(o,Math.max(n,Math.round((a+e*s)/s)*s));c=Number(c.toFixed(s<1?1:0)),"low"===t&&null!=r.high&&(c=Math.min(c,r.high)),"high"===t&&null!=r.low&&(c=Math.max(c,r.low)),this._pending={...r,[t]:c},this._scheduleTemp(1e3)}_stepHumidity(t){const e=this._stateObj;if(!e)return;const i=Number(e.attributes.min_humidity??30),s=Number(e.attributes.max_humidity??99),n=this._pendingHumidity??Number(e.attributes.humidity??50);this._pendingHumidity=Math.min(s,Math.max(i,n+t)),clearTimeout(this._humTimer),this._humTimer=window.setTimeout(()=>this._call("set_humidity",{humidity:this._pendingHumidity}),1e3)}_setMode(t){this._call("set_hvac_mode",{hvac_mode:t.detail.mode})}_togglePower(){const t=this._stateObj;if(!t)return;const e=t.attributes;if("off"===t.state)if(At(e,$t))this._call("turn_on");else{const t=e.hvac_modes?.find(t=>"off"!==t);t&&this._call("set_hvac_mode",{hvac_mode:t})}else At(e,xt)?this._call("turn_off"):this._call("set_hvac_mode",{hvac_mode:"off"})}_moreInfo(t){this.dispatchEvent(new CustomEvent("hass-more-info",{detail:{entityId:t??this._config?.entity},bubbles:!0,composed:!0}))}_renderHeader(t,e,i){const s=t.attributes.hvac_action,n=s?Lt(this.hass,t,"hvac_action",s):It(this.hass,t,t.state),o=t.attributes.preset_mode&&"none"!==t.attributes.preset_mode?` · ${Lt(this.hass,t,"preset_mode",t.attributes.preset_mode)}`:"",r=(t.attributes.hvac_modes??[]).includes("off")||At(t.attributes,xt);return W`
      <div class="header">
        <button class="title" @click=${()=>this._moreInfo()}>
          <span class="icon-badge ${this._isActive(t)?"active":""}" style="--accent:${i}">
            <ha-icon .icon=${this._config.icon??Et[s??""]??Ct[t.state]??"mdi:air-conditioner"}></ha-icon>
          </span>
          <span class="names">
            <span class="name">${e}</span>
            <span class="status">${n}${o}</span>
          </span>
        </button>
        ${r?W`
          <button class="power ${"off"!==t.state?"on":""}" style="--accent:${i}"
            title=${this._t("off"===t.state?"card.turn_on":"card.turn_off")}
            aria-label=${this._t("off"===t.state?"card.turn_on":"card.turn_off")}
            @click=${this._togglePower}>
            <ha-icon icon="mdi:power"></ha-icon>
          </button>`:q}
      </div>`}_renderHints(t){const e=this._config,i=[];if(this._windowOpen()&&i.push(W`<div class="banner" @click=${()=>this._moreInfo(e.window_sensor)}>
        <ha-icon icon="mdi:window-open-variant"></ha-icon>
        <div><strong>${this._t("card.window_open")}</strong><span>${this._t("card.window_open_hint")}</span></div>
      </div>`),this._show.hints){const s=this._currentTemp(t),n=this._outdoorTemp(),o=e.ventilation_delta??3,r="cool"===t.state||"cooling"===t.attributes.hvac_action,a="heat"===t.state||"heating"===t.attributes.hvac_action;if(!this._windowOpen()&&null!=s&&null!=n){const t=t=>`${t.toFixed(1)}°`;r&&s-n>=o?i.push(W`<div class="banner info">
            <ha-icon icon="mdi:weather-windy"></ha-icon>
            <div><strong>${this._t("card.ventilate_cool")}</strong>
              <span>${this._t("card.outside")} ${t(n)} · ${this._t("card.inside")} ${t(s)} – ${this._t("card.ventilate_hint")}</span></div>
          </div>`):a&&n-s>=o&&i.push(W`<div class="banner info">
            <ha-icon icon="mdi:weather-windy"></ha-icon>
            <div><strong>${this._t("card.ventilate_heat")}</strong>
              <span>${this._t("card.outside")} ${t(n)} · ${this._t("card.inside")} ${t(s)} – ${this._t("card.ventilate_hint")}</span></div>
          </div>`)}const c=this._currentHumidity(t),l=e.humidity_warning??70;if(null!=c&&l>0&&c>=l){const e=null!=s?le(s,c,this._unit):void 0,n=(t.attributes.hvac_modes??[]).includes("dry")&&"dry"!==t.state;i.push(W`<div class="banner humid">
          <ha-icon icon="mdi:water-alert"></ha-icon>
          <div><strong>${this._t("card.humidity_high")} (${Math.round(c)} %)</strong>
            <span>${this._t("card.mold_hint")}${null!=e?` · ${this._t("card.dew_point")} ${e.toFixed(1)}°`:""}</span></div>
          ${n?W`<button class="banner-action" @click=${()=>this._call("set_hvac_mode",{hvac_mode:"dry"})}>
            ${this._t("card.start_dry")}</button>`:q}
        </div>`)}}return i.length?W`<div class="hints">${i}</div>`:q}_renderStepper(t,e,i,s){return W`<div class="stepper" style=${s?`--accent:${s}`:""}>
      <button aria-label="-" @click=${()=>this._stepTarget(t,-1)}><ha-icon icon="mdi:minus"></ha-icon></button>
      <span class="stepper-value">${this._fmt(e,i)}<small>${this._unit}</small></span>
      <button aria-label="+" @click=${()=>this._stepTarget(t,1)}><ha-icon icon="mdi:plus"></ha-icon></button>
    </div>`}_renderDial(t,e){const i=t.attributes,s=this._step(t),n=this._isDual(t),o=this._targets(t),r=this._currentTemp(t),a="off"===t.state,c=n||null!=o.value&&At(i,ft),l=this._currentHumidity(t);return W`
      <hcc-climate-dial
        .min=${Number(i.min_temp??7)} .max=${Number(i.max_temp??35)} .step=${s}
        .value=${o.value} .low=${o.low} .high=${o.high} .current=${r}
        .dual=${n} .disabled=${a||!c} .color=${e} .active=${this._isActive(t)}
        .fade=${["dry","fan_only"].includes(t.state)}
        @value-changing=${this._onDialChanging} @value-changed=${this._onDialChanged}>
        <div class="dial-center">
          <span class="dial-label">${a?It(this.hass,t,"off"):this._t("card.target")}</span>
          ${a||!c?W`<span class="dial-big">${this._fmt(r,s)}<sup>${this._unit}</sup></span>`:n?W`<span class="dial-range">
                  <span style="color:var(--state-climate-heat-color,#ff6d00)">${this._fmt(o.low,s)}</span>
                  <span class="sep">–</span>
                  <span style="color:var(--state-climate-cool-color,#2196f3)">${this._fmt(o.high,s)}</span>
                </span>`:W`<span class="dial-big">${this._fmt(o.value,s)}<sup>${this._unit}</sup></span>`}
          <span class="dial-sub">
            ${!a&&c?W`<ha-icon icon="mdi:home-thermometer-outline"></ha-icon>${this._fmt(r,s)}${this._unit}`:q}
            ${null!=l?W`<ha-icon icon="mdi:water-percent"></ha-icon>${Math.round(Number(l))}%`:q}
          </span>
        </div>
      </hcc-climate-dial>
      ${!a&&c?W`<div class="dial-steppers ${n?"dual":""}">
        ${n?W`${this._renderStepper("low",o.low,s,"var(--state-climate-heat-color,#ff6d00)")}
                 ${this._renderStepper("high",o.high,s,"var(--state-climate-cool-color,#2196f3)")}`:W`<button class="round" aria-label="-" @click=${()=>this._stepTarget("value",-1)}><ha-icon icon="mdi:minus"></ha-icon></button>
                 <button class="round" aria-label="+" @click=${()=>this._stepTarget("value",1)}><ha-icon icon="mdi:plus"></ha-icon></button>`}
      </div>`:q}`}_sections(t,e){const i=t.attributes,s=this._show,n=this.hass,o=[],r=(t,e)=>o.push({key:e,tpl:t}),a=(i.hvac_modes??[]).slice().sort((t,e)=>St.indexOf(t)-St.indexOf(e)).map(e=>({value:e,label:It(n,t,e)}));s.modes&&a.length>1&&r(W`<hcc-mode-bar .modes=${a} .selected=${t.state} @mode-selected=${this._setMode}></hcc-mode-bar>`,"modes");const c=(e,s,o,a,c,l,h,d)=>{const p=i[o];d&&At(i,a)&&p?.length&&r(W`<hcc-attribute-select .label=${this._t(c)} .icon=${l} .selected=${i[s]}
        .options=${p.map(e=>({value:e,label:Lt(n,t,s,e)}))}
        .dropdownThreshold=${this._config.dropdown_threshold??6}
        @option-selected=${t=>this._call(h,{[s]:t.detail.value})}>
      </hcc-attribute-select>`,e)};if(c("fan","fan_mode","fan_modes",yt,"card.fan","mdi:fan","set_fan_mode",s.fan),c("swing","swing_mode","swing_modes",wt,"card.swing","mdi:arrow-oscillating","set_swing_mode",s.swing),c("swing","swing_horizontal_mode","swing_horizontal_modes",kt,"card.swing_horizontal","mdi:arrow-left-right","set_swing_horizontal_mode",s.swing),c("presets","preset_mode","preset_modes",vt,"card.preset","mdi:star-outline","set_preset_mode",s.presets),s.timer&&(this._config.timer_switch||this._config.timer_time)&&r(W`<hcc-sleep-timer .hass=${n} .switchEntity=${this._config.timer_switch}
        .timeEntity=${this._config.timer_time} .label=${this._t("card.sleep_timer")} .offText=${this._t("card.timer_off")}
        .atText=${this._t("card.timer_at")} .inText=${this._t("card.timer_in")}></hcc-sleep-timer>`,"timer"),s.timer&&this._config.countdown_timer&&n.states[this._config.countdown_timer]&&r(W`<hcc-countdown-timer .hass=${n} .entity=${this._config.countdown_timer}
        .durations=${this._config.countdown_durations??[30,60,90,120]}
        .label=${this._t("card.countdown")} .cancelText=${this._t("card.cancel")}></hcc-countdown-timer>`,"countdown"),s.shortcuts){const e=this._shortcutItems(t);e.length&&r(W`<hcc-shortcut-row .hass=${n} .items=${e}></hcc-shortcut-row>`,"shortcuts")}if(s.humidity&&At(i,bt)&&null!=i.humidity){const t=this._pendingHumidity??Number(i.humidity);r(W`<div class="humidity-row">
        <span class="row-label"><ha-icon icon="mdi:water-percent"></ha-icon>${this._t("card.target_humidity")}</span>
        <div class="stepper">
          <button aria-label="-" @click=${()=>this._stepHumidity(-1)}><ha-icon icon="mdi:minus"></ha-icon></button>
          <span class="stepper-value">${t}<small>%</small></span>
          <button aria-label="+" @click=${()=>this._stepHumidity(1)}><ha-icon icon="mdi:plus"></ha-icon></button>
        </div>
      </div>`,"humidity")}if(s.sensors){const e=this._sensorItems(t);e.length&&r(W`<hcc-sensor-row .items=${e}></hcc-sensor-row>`,"sensors")}return s.graph&&r(W`<div class="graph-wrap">
        <span class="row-label"><ha-icon icon="mdi:chart-line"></ha-icon>${this._t("card.history")}</span>
        <hcc-history-graph .hass=${n} .entity=${t.entity_id}
          .sensor=${this._externalTemp?.entity_id}
          .hours=${this._config.graph_hours??24} .unit=${this._unit} .emptyText=${this._t("card.no_history")}
          style="--hcc-accent:${e}"></hcc-history-graph>
      </div>`,"graph"),o}_renderSections(t,e){return t.length?W`<div class="controls" style="--hcc-accent:${e}">${t.map(t=>t.tpl)}</div>`:q}_renderExpandButton(){return W`<button class="expand" @click=${()=>{this._expanded=!this._expanded}} aria-expanded=${this._expanded}>
      <span>${this._t(this._expanded?"card.less":"card.more")}</span>
      <ha-icon icon=${this._expanded?"mdi:chevron-up":"mdi:chevron-down"}></ha-icon>
    </button>`}_renderFullControls(t,e){const i=this._sections(t,e);if(!1===this._config.expandable)return this._renderSections(i,e);const s=i.filter(t=>Nt.includes(t.key)),n=i.filter(t=>!Nt.includes(t.key));return W`
      ${this._renderSections(s,e)}
      ${n.length?W`
        ${this._expanded?this._renderSections(n,e):q}
        ${this._renderExpandButton()}`:q}`}_sensorItems(t){const e=this._config,i=[],s=(t,e,s,n=!1)=>{const o=this._sensorState(t);null!=o&&i.push({entity:t,icon:e,label:this._t(s),value:o,warning:n})};if(e.temperature_sensor&&!1===e.use_sensor_for_current){const t=this.hass.states[e.temperature_sensor],s=this._tempOf(t);t&&i.push({entity:t.entity_id,icon:"mdi:home-thermometer-outline",label:this._t("card.current"),value:null!=s?`${s} ${this._unit}`:"–"})}const n=this._currentHumidity(t);if("compact"===this._config?.layout&&null!=n&&i.push({entity:e.humidity_sensor,icon:"mdi:water-percent",label:this._t("card.humidity"),value:`${Math.round(n)} %`}),s(e.outdoor_sensor,"mdi:thermometer","card.outdoor"),e.weather_entity&&this.hass.states[e.weather_entity]){const t=this.hass.states[e.weather_entity],s=this._forecast,n=s?.condition??t.state,o=null!=s?.temperature?`${Math.round(s.temperature)}°${null!=s.templow?` / ${Math.round(s.templow)}°`:""}`:this._sensorState(e.weather_entity)??"–",r=s?.precipitation_probability?` · ☂ ${s.precipitation_probability} %`:"";i.push({entity:e.weather_entity,icon:he[n]??"mdi:weather-partly-cloudy",label:`${this._t("card.today")}${r}`,value:o})}if(this._show.hints){const s=this._currentTemp(t),n=this._currentHumidity(t),o=null!=s&&null!=n?le(s,n,this._unit):void 0;null!=o&&i.push({icon:"mdi:water-thermometer-outline",label:this._t("card.dew_point"),value:`${o.toFixed(1)} ${this._unit}`,warning:n>=(e.humidity_warning??70)})}if(s(e.power_sensor,"mdi:flash","card.power"),s(e.energy_sensor,"mdi:lightning-bolt","card.energy"),e.window_sensor&&this.hass.states[e.window_sensor]){const t=this._windowOpen();i.push({entity:e.window_sensor,icon:t?"mdi:window-open-variant":"mdi:window-closed-variant",label:this.hass.states[e.window_sensor].attributes.friendly_name??"Window",value:this._sensorState(e.window_sensor)??"",warning:t})}return i}_renderCompact(t,e,i){const s=this._step(t),n=this._isDual(t),o=this._targets(t),r="off"===t.state,a=n||null!=o.value&&At(t.attributes,ft),c=this._currentTemp(t);return W`
      <div class="compact-top">
        ${this._renderHeader(t,e,i)}
      </div>
      <div class="compact-row">
        <div class="compact-current">
          <span class="big">${this._fmt(c,s)}<sup>${this._unit}</sup></span>
          <span class="dial-label">${this._t("card.current")}</span>
        </div>
        ${!r&&a?n?W`<div class="compact-steppers">
                ${this._renderStepper("low",o.low,s,"var(--state-climate-heat-color,#ff6d00)")}
                ${this._renderStepper("high",o.high,s,"var(--state-climate-cool-color,#2196f3)")}
              </div>`:this._renderStepper("value",o.value,s,i):q}
      </div>
      ${this._renderHints(t)}
      ${this._renderExpandButton()}
      ${this._expanded?this._renderSections(this._sections(t,i),i):q}`}_renderAirflow(t,e){if(!this._show.airflow||!re(t))return q;const i=t.attributes,s=i.fan_modes??[],n=s.indexOf(i.fan_mode),o=/auto/i.test(i.fan_mode??""),r=n<0||o?.5:s.filter(t=>!/auto/i.test(t)).indexOf(i.fan_mode)/Math.max(1,s.filter(t=>!/auto/i.test(t)).length-1),a=t=>!!t&&/swing|^on$|both|vertical|auto/i.test(t)&&!/fixed/i.test(t),c=a(i.swing_mode)&&!/^horizontal$/i.test(i.swing_mode),l=a(i.swing_horizontal_mode)||/both|horizontal/i.test(i.swing_mode??"");return W`<hcc-airflow .speed=${Math.max(0,Math.min(1,r))} .swingVertical=${c} .swingHorizontal=${l} .color=${e}></hcc-airflow>`}render(){if(!this._config||!this.hass)return q;const t=this._stateObj;if(!t)return W`<ha-card><div class="warning">${this._t("card.entity_not_found")}: ${this._config.entity}</div></ha-card>`;const e=this._config.name??t.attributes.friendly_name??t.entity_id;if(ye.includes(t.state))return W`<ha-card class="unavailable">
        ${this._renderHeader(t,e,Tt.off)}
        <div class="warning">${this._t("card.unavailable")}</div>
      </ha-card>`;const i=this._modeColor(t),s="compact"===this._config.layout;return W`<ha-card class=${s?"compact":"full"} style="--accent:${i}">
      <div class="glow"></div>
      ${this._renderAirflow(t,i)}
      ${s?this._renderCompact(t,e,i):W`
          ${this._renderHeader(t,e,i)}
          ${this._renderHints(t)}
          ${this._renderDial(t,i)}
          ${this._renderFullControls(t,i)}`}
    </ha-card>`}};ve.styles=Ft,t([mt({attribute:!1})],ve.prototype,"hass",void 0),t([_t()],ve.prototype,"_config",void 0),t([_t()],ve.prototype,"_pending",void 0),t([_t()],ve.prototype,"_pendingHumidity",void 0),t([_t()],ve.prototype,"_expanded",void 0),t([_t()],ve.prototype,"_forecast",void 0),ve=t([dt("ha-climate-card")],ve);export{ve as HaClimateCard};
