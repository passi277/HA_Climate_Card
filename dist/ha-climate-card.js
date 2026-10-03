function t(t,e,i,s){var n,o=arguments.length,r=o<3?e:null===s?s=Object.getOwnPropertyDescriptor(e,i):s;if("object"==typeof Reflect&&"function"==typeof Reflect.decorate)r=Reflect.decorate(t,e,i,s);else for(var a=t.length-1;a>=0;a--)(n=t[a])&&(r=(o<3?n(r):o>3?n(e,i,r):n(e,i))||r);return o>3&&r&&Object.defineProperty(e,i,r),r}"function"==typeof SuppressedError&&SuppressedError;const e=globalThis,i=e.ShadowRoot&&(void 0===e.ShadyCSS||e.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,s=Symbol(),n=new WeakMap;let o=class{constructor(t,e,i){if(this._$cssResult$=!0,i!==s)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=t,this.t=e}get styleSheet(){let t=this.o;const e=this.t;if(i&&void 0===t){const i=void 0!==e&&1===e.length;i&&(t=n.get(e)),void 0===t&&((this.o=t=new CSSStyleSheet).replaceSync(this.cssText),i&&n.set(e,t))}return t}toString(){return this.cssText}};const r=(t,...e)=>{const i=1===t.length?t[0]:e.reduce((e,i,s)=>e+(t=>{if(!0===t._$cssResult$)return t.cssText;if("number"==typeof t)return t;throw Error("Value passed to 'css' function must be a 'css' function result: "+t+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(i)+t[s+1],t[0]);return new o(i,t,s)},a=i?t=>t:t=>t instanceof CSSStyleSheet?(t=>{let e="";for(const i of t.cssRules)e+=i.cssText;return(t=>new o("string"==typeof t?t:t+"",void 0,s))(e)})(t):t,{is:c,defineProperty:l,getOwnPropertyDescriptor:h,getOwnPropertyNames:d,getOwnPropertySymbols:p,getPrototypeOf:u}=Object,m=globalThis,f=m.trustedTypes,_=f?f.emptyScript:"",g=m.reactiveElementPolyfillSupport,b=(t,e)=>t,v={toAttribute(t,e){switch(e){case Boolean:t=t?_:null;break;case Object:case Array:t=null==t?t:JSON.stringify(t)}return t},fromAttribute(t,e){let i=t;switch(e){case Boolean:i=null!==t;break;case Number:i=null===t?null:Number(t);break;case Object:case Array:try{i=JSON.parse(t)}catch(t){i=null}}return i}},y=(t,e)=>!c(t,e),w={attribute:!0,type:String,converter:v,reflect:!1,useDefault:!1,hasChanged:y};Symbol.metadata??=Symbol("metadata"),m.litPropertyMetadata??=new WeakMap;let x=class extends HTMLElement{static addInitializer(t){this._$Ei(),(this.l??=[]).push(t)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(t,e=w){if(e.state&&(e.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(t)&&((e=Object.create(e)).wrapped=!0),this.elementProperties.set(t,e),!e.noAccessor){const i=Symbol(),s=this.getPropertyDescriptor(t,i,e);void 0!==s&&l(this.prototype,t,s)}}static getPropertyDescriptor(t,e,i){const{get:s,set:n}=h(this.prototype,t)??{get(){return this[e]},set(t){this[e]=t}};return{get:s,set(e){const o=s?.call(this);n?.call(this,e),this.requestUpdate(t,o,i)},configurable:!0,enumerable:!0}}static getPropertyOptions(t){return this.elementProperties.get(t)??w}static _$Ei(){if(this.hasOwnProperty(b("elementProperties")))return;const t=u(this);t.finalize(),void 0!==t.l&&(this.l=[...t.l]),this.elementProperties=new Map(t.elementProperties)}static finalize(){if(this.hasOwnProperty(b("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(b("properties"))){const t=this.properties,e=[...d(t),...p(t)];for(const i of e)this.createProperty(i,t[i])}const t=this[Symbol.metadata];if(null!==t){const e=litPropertyMetadata.get(t);if(void 0!==e)for(const[t,i]of e)this.elementProperties.set(t,i)}this._$Eh=new Map;for(const[t,e]of this.elementProperties){const i=this._$Eu(t,e);void 0!==i&&this._$Eh.set(i,t)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(t){const e=[];if(Array.isArray(t)){const i=new Set(t.flat(1/0).reverse());for(const t of i)e.unshift(a(t))}else void 0!==t&&e.push(a(t));return e}static _$Eu(t,e){const i=e.attribute;return!1===i?void 0:"string"==typeof i?i:"string"==typeof t?t.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){this._$ES=new Promise(t=>this.enableUpdating=t),this._$AL=new Map,this._$E_(),this.requestUpdate(),this.constructor.l?.forEach(t=>t(this))}addController(t){(this._$EO??=new Set).add(t),void 0!==this.renderRoot&&this.isConnected&&t.hostConnected?.()}removeController(t){this._$EO?.delete(t)}_$E_(){const t=new Map,e=this.constructor.elementProperties;for(const i of e.keys())this.hasOwnProperty(i)&&(t.set(i,this[i]),delete this[i]);t.size>0&&(this._$Ep=t)}createRenderRoot(){const t=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return((t,s)=>{if(i)t.adoptedStyleSheets=s.map(t=>t instanceof CSSStyleSheet?t:t.styleSheet);else for(const i of s){const s=document.createElement("style"),n=e.litNonce;void 0!==n&&s.setAttribute("nonce",n),s.textContent=i.cssText,t.appendChild(s)}})(t,this.constructor.elementStyles),t}connectedCallback(){this.renderRoot??=this.createRenderRoot(),this.enableUpdating(!0),this._$EO?.forEach(t=>t.hostConnected?.())}enableUpdating(t){}disconnectedCallback(){this._$EO?.forEach(t=>t.hostDisconnected?.())}attributeChangedCallback(t,e,i){this._$AK(t,i)}_$ET(t,e){const i=this.constructor.elementProperties.get(t),s=this.constructor._$Eu(t,i);if(void 0!==s&&!0===i.reflect){const n=(void 0!==i.converter?.toAttribute?i.converter:v).toAttribute(e,i.type);this._$Em=t,null==n?this.removeAttribute(s):this.setAttribute(s,n),this._$Em=null}}_$AK(t,e){const i=this.constructor,s=i._$Eh.get(t);if(void 0!==s&&this._$Em!==s){const t=i.getPropertyOptions(s),n="function"==typeof t.converter?{fromAttribute:t.converter}:void 0!==t.converter?.fromAttribute?t.converter:v;this._$Em=s;const o=n.fromAttribute(e,t.type);this[s]=o??this._$Ej?.get(s)??o,this._$Em=null}}requestUpdate(t,e,i,s=!1,n){if(void 0!==t){const o=this.constructor;if(!1===s&&(n=this[t]),i??=o.getPropertyOptions(t),!((i.hasChanged??y)(n,e)||i.useDefault&&i.reflect&&n===this._$Ej?.get(t)&&!this.hasAttribute(o._$Eu(t,i))))return;this.C(t,e,i)}!1===this.isUpdatePending&&(this._$ES=this._$EP())}C(t,e,{useDefault:i,reflect:s,wrapped:n},o){i&&!(this._$Ej??=new Map).has(t)&&(this._$Ej.set(t,o??e??this[t]),!0!==n||void 0!==o)||(this._$AL.has(t)||(this.hasUpdated||i||(e=void 0),this._$AL.set(t,e)),!0===s&&this._$Em!==t&&(this._$Eq??=new Set).add(t))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(t){Promise.reject(t)}const t=this.scheduleUpdate();return null!=t&&await t,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??=this.createRenderRoot(),this._$Ep){for(const[t,e]of this._$Ep)this[t]=e;this._$Ep=void 0}const t=this.constructor.elementProperties;if(t.size>0)for(const[e,i]of t){const{wrapped:t}=i,s=this[e];!0!==t||this._$AL.has(e)||void 0===s||this.C(e,void 0,i,s)}}let t=!1;const e=this._$AL;try{t=this.shouldUpdate(e),t?(this.willUpdate(e),this._$EO?.forEach(t=>t.hostUpdate?.()),this.update(e)):this._$EM()}catch(e){throw t=!1,this._$EM(),e}t&&this._$AE(e)}willUpdate(t){}_$AE(t){this._$EO?.forEach(t=>t.hostUpdated?.()),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(t)),this.updated(t)}_$EM(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(t){return!0}update(t){this._$Eq&&=this._$Eq.forEach(t=>this._$ET(t,this[t])),this._$EM()}updated(t){}firstUpdated(t){}};x.elementStyles=[],x.shadowRootOptions={mode:"open"},x[b("elementProperties")]=new Map,x[b("finalized")]=new Map,g?.({ReactiveElement:x}),(m.reactiveElementVersions??=[]).push("2.1.2");const $=globalThis,k=t=>t,A=$.trustedTypes,S=A?A.createPolicy("lit-html",{createHTML:t=>t}):void 0,C="$lit$",E=`lit$${Math.random().toFixed(9).slice(2)}$`,T="?"+E,M=`<${T}>`,z=document,N=()=>z.createComment(""),H=t=>null===t||"object"!=typeof t&&"function"!=typeof t,O=Array.isArray,D="[ \t\n\f\r]",P=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,L=/-->/g,F=/>/g,I=RegExp(`>|${D}(?:([^\\s"'>=/]+)(${D}*=${D}*(?:[^ \t\n\f\r"'\`<>=]|("|')|))|$)`,"g"),U=/'/g,R=/"/g,j=/^(?:script|style|textarea|title)$/i,B=t=>(e,...i)=>({_$litType$:t,strings:e,values:i}),V=B(1),W=B(2),K=Symbol.for("lit-noChange"),G=Symbol.for("lit-nothing"),q=new WeakMap,Y=z.createTreeWalker(z,129);function Z(t,e){if(!O(t)||!t.hasOwnProperty("raw"))throw Error("invalid template strings array");return void 0!==S?S.createHTML(e):e}const X=(t,e)=>{const i=t.length-1,s=[];let n,o=2===e?"<svg>":3===e?"<math>":"",r=P;for(let e=0;e<i;e++){const i=t[e];let a,c,l=-1,h=0;for(;h<i.length&&(r.lastIndex=h,c=r.exec(i),null!==c);)h=r.lastIndex,r===P?"!--"===c[1]?r=L:void 0!==c[1]?r=F:void 0!==c[2]?(j.test(c[2])&&(n=RegExp("</"+c[2],"g")),r=I):void 0!==c[3]&&(r=I):r===I?">"===c[0]?(r=n??P,l=-1):void 0===c[1]?l=-2:(l=r.lastIndex-c[2].length,a=c[1],r=void 0===c[3]?I:'"'===c[3]?R:U):r===R||r===U?r=I:r===L||r===F?r=P:(r=I,n=void 0);const d=r===I&&t[e+1].startsWith("/>")?" ":"";o+=r===P?i+M:l>=0?(s.push(a),i.slice(0,l)+C+i.slice(l)+E+d):i+E+(-2===l?e:d)}return[Z(t,o+(t[i]||"<?>")+(2===e?"</svg>":3===e?"</math>":"")),s]};class J{constructor({strings:t,_$litType$:e},i){let s;this.parts=[];let n=0,o=0;const r=t.length-1,a=this.parts,[c,l]=X(t,e);if(this.el=J.createElement(c,i),Y.currentNode=this.el.content,2===e||3===e){const t=this.el.content.firstChild;t.replaceWith(...t.childNodes)}for(;null!==(s=Y.nextNode())&&a.length<r;){if(1===s.nodeType){if(s.hasAttributes())for(const t of s.getAttributeNames())if(t.endsWith(C)){const e=l[o++],i=s.getAttribute(t).split(E),r=/([.?@])?(.*)/.exec(e);a.push({type:1,index:n,name:r[2],strings:i,ctor:"."===r[1]?st:"?"===r[1]?nt:"@"===r[1]?ot:it}),s.removeAttribute(t)}else t.startsWith(E)&&(a.push({type:6,index:n}),s.removeAttribute(t));if(j.test(s.tagName)){const t=s.textContent.split(E),e=t.length-1;if(e>0){s.textContent=A?A.emptyScript:"";for(let i=0;i<e;i++)s.append(t[i],N()),Y.nextNode(),a.push({type:2,index:++n});s.append(t[e],N())}}}else if(8===s.nodeType)if(s.data===T)a.push({type:2,index:n});else{let t=-1;for(;-1!==(t=s.data.indexOf(E,t+1));)a.push({type:7,index:n}),t+=E.length-1}n++}}static createElement(t,e){const i=z.createElement("template");return i.innerHTML=t,i}}function Q(t,e,i=t,s){if(e===K)return e;let n=void 0!==s?i._$Co?.[s]:i._$Cl;const o=H(e)?void 0:e._$litDirective$;return n?.constructor!==o&&(n?._$AO?.(!1),void 0===o?n=void 0:(n=new o(t),n._$AT(t,i,s)),void 0!==s?(i._$Co??=[])[s]=n:i._$Cl=n),void 0!==n&&(e=Q(t,n._$AS(t,e.values),n,s)),e}let tt=class{constructor(t,e){this._$AV=[],this._$AN=void 0,this._$AD=t,this._$AM=e}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(t){const{el:{content:e},parts:i}=this._$AD,s=(t?.creationScope??z).importNode(e,!0);Y.currentNode=s;let n=Y.nextNode(),o=0,r=0,a=i[0];for(;void 0!==a;){if(o===a.index){let e;2===a.type?e=new et(n,n.nextSibling,this,t):1===a.type?e=new a.ctor(n,a.name,a.strings,this,t):6===a.type&&(e=new rt(n,this,t)),this._$AV.push(e),a=i[++r]}o!==a?.index&&(n=Y.nextNode(),o++)}return Y.currentNode=z,s}p(t){let e=0;for(const i of this._$AV)void 0!==i&&(void 0!==i.strings?(i._$AI(t,i,e),e+=i.strings.length-2):i._$AI(t[e])),e++}};class et{get _$AU(){return this._$AM?._$AU??this._$Cv}constructor(t,e,i,s){this.type=2,this._$AH=G,this._$AN=void 0,this._$AA=t,this._$AB=e,this._$AM=i,this.options=s,this._$Cv=s?.isConnected??!0}get parentNode(){let t=this._$AA.parentNode;const e=this._$AM;return void 0!==e&&11===t?.nodeType&&(t=e.parentNode),t}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(t,e=this){t=Q(this,t,e),H(t)?t===G||null==t||""===t?(this._$AH!==G&&this._$AR(),this._$AH=G):t!==this._$AH&&t!==K&&this._(t):void 0!==t._$litType$?this.$(t):void 0!==t.nodeType?this.T(t):(t=>O(t)||"function"==typeof t?.[Symbol.iterator])(t)?this.k(t):this._(t)}O(t){return this._$AA.parentNode.insertBefore(t,this._$AB)}T(t){this._$AH!==t&&(this._$AR(),this._$AH=this.O(t))}_(t){this._$AH!==G&&H(this._$AH)?this._$AA.nextSibling.data=t:this.T(z.createTextNode(t)),this._$AH=t}$(t){const{values:e,_$litType$:i}=t,s="number"==typeof i?this._$AC(t):(void 0===i.el&&(i.el=J.createElement(Z(i.h,i.h[0]),this.options)),i);if(this._$AH?._$AD===s)this._$AH.p(e);else{const t=new tt(s,this),i=t.u(this.options);t.p(e),this.T(i),this._$AH=t}}_$AC(t){let e=q.get(t.strings);return void 0===e&&q.set(t.strings,e=new J(t)),e}k(t){O(this._$AH)||(this._$AH=[],this._$AR());const e=this._$AH;let i,s=0;for(const n of t)s===e.length?e.push(i=new et(this.O(N()),this.O(N()),this,this.options)):i=e[s],i._$AI(n),s++;s<e.length&&(this._$AR(i&&i._$AB.nextSibling,s),e.length=s)}_$AR(t=this._$AA.nextSibling,e){for(this._$AP?.(!1,!0,e);t!==this._$AB;){const e=k(t).nextSibling;k(t).remove(),t=e}}setConnected(t){void 0===this._$AM&&(this._$Cv=t,this._$AP?.(t))}}let it=class{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(t,e,i,s,n){this.type=1,this._$AH=G,this._$AN=void 0,this.element=t,this.name=e,this._$AM=s,this.options=n,i.length>2||""!==i[0]||""!==i[1]?(this._$AH=Array(i.length-1).fill(new String),this.strings=i):this._$AH=G}_$AI(t,e=this,i,s){const n=this.strings;let o=!1;if(void 0===n)t=Q(this,t,e,0),o=!H(t)||t!==this._$AH&&t!==K,o&&(this._$AH=t);else{const s=t;let r,a;for(t=n[0],r=0;r<n.length-1;r++)a=Q(this,s[i+r],e,r),a===K&&(a=this._$AH[r]),o||=!H(a)||a!==this._$AH[r],a===G?t=G:t!==G&&(t+=(a??"")+n[r+1]),this._$AH[r]=a}o&&!s&&this.j(t)}j(t){t===G?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,t??"")}};class st extends it{constructor(){super(...arguments),this.type=3}j(t){this.element[this.name]=t===G?void 0:t}}class nt extends it{constructor(){super(...arguments),this.type=4}j(t){this.element.toggleAttribute(this.name,!!t&&t!==G)}}class ot extends it{constructor(t,e,i,s,n){super(t,e,i,s,n),this.type=5}_$AI(t,e=this){if((t=Q(this,t,e,0)??G)===K)return;const i=this._$AH,s=t===G&&i!==G||t.capture!==i.capture||t.once!==i.once||t.passive!==i.passive,n=t!==G&&(i===G||s);s&&this.element.removeEventListener(this.name,this,i),n&&this.element.addEventListener(this.name,this,t),this._$AH=t}handleEvent(t){"function"==typeof this._$AH?this._$AH.call(this.options?.host??this.element,t):this._$AH.handleEvent(t)}}class rt{constructor(t,e,i){this.element=t,this.type=6,this._$AN=void 0,this._$AM=e,this.options=i}get _$AU(){return this._$AM._$AU}_$AI(t){Q(this,t)}}const at=$.litHtmlPolyfillSupport;at?.(J,et),($.litHtmlVersions??=[]).push("3.3.3");const ct=globalThis;class lt extends x{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){const t=super.createRenderRoot();return this.renderOptions.renderBefore??=t.firstChild,t}update(t){const e=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(t),this._$Do=((t,e,i)=>{const s=i?.renderBefore??e;let n=s._$litPart$;if(void 0===n){const t=i?.renderBefore??null;s._$litPart$=n=new et(e.insertBefore(N(),t),t,void 0,i??{})}return n._$AI(t),n})(e,this.renderRoot,this.renderOptions)}connectedCallback(){super.connectedCallback(),this._$Do?.setConnected(!0)}disconnectedCallback(){super.disconnectedCallback(),this._$Do?.setConnected(!1)}render(){return K}}lt._$litElement$=!0,lt.finalized=!0,ct.litElementHydrateSupport?.({LitElement:lt});const ht=ct.litElementPolyfillSupport;ht?.({LitElement:lt}),(ct.litElementVersions??=[]).push("4.2.2");const dt=t=>(e,i)=>{void 0!==i?i.addInitializer(()=>{customElements.define(t,e)}):customElements.define(t,e)},pt={attribute:!0,type:String,converter:v,reflect:!1,hasChanged:y},ut=(t=pt,e,i)=>{const{kind:s,metadata:n}=i;let o=globalThis.litPropertyMetadata.get(n);if(void 0===o&&globalThis.litPropertyMetadata.set(n,o=new Map),"setter"===s&&((t=Object.create(t)).wrapped=!0),o.set(i.name,t),"accessor"===s){const{name:s}=i;return{set(i){const n=e.get.call(this);e.set.call(this,i),this.requestUpdate(s,n,t,!0,i)},init(e){return void 0!==e&&this.C(s,void 0,t,e),e}}}if("setter"===s){const{name:s}=i;return function(i){const n=this[s];e.call(this,i),this.requestUpdate(s,n,t,!0,i)}}throw Error("Unsupported decorator location: "+s)};function mt(t){return(e,i)=>"object"==typeof i?ut(t,e,i):((t,e,i)=>{const s=e.hasOwnProperty(i);return e.constructor.createProperty(i,t),s?Object.getOwnPropertyDescriptor(e,i):void 0})(t,e,i)}function ft(t){return mt({...t,state:!0,attribute:!1})}function _t(t,e){return(e,i,s)=>((t,e,i)=>(i.configurable=!0,i.enumerable=!0,Reflect.decorate&&"object"!=typeof e&&Object.defineProperty(t,e,i),i))(e,i,{get(){return(e=>e.renderRoot?.querySelector(t)??null)(this)}})}const gt=1,bt=2,vt=4,yt=8,wt=16,xt=32,$t=128,kt=256,At=512,St=(t,e)=>0!==((t.supported_features??0)&e),Ct=["auto","heat_cool","heat","cool","dry","fan_only","off"],Et={auto:"mdi:thermostat-auto",heat_cool:"mdi:sun-snowflake-variant",heat:"mdi:fire",cool:"mdi:snowflake",dry:"mdi:water-percent",fan_only:"mdi:fan",off:"mdi:power"},Tt={heating:"mdi:fire",cooling:"mdi:snowflake",drying:"mdi:water-percent",fan:"mdi:fan",idle:"mdi:clock-outline",off:"mdi:power",preheating:"mdi:heat-wave",defrosting:"mdi:snowflake-melt"},Mt={auto:"var(--state-climate-auto-color, #43a047)",heat_cool:"var(--state-climate-heat_cool-color, #ffa000)",heat:"var(--state-climate-heat-color, #ff6d00)",cool:"var(--state-climate-cool-color, #2196f3)",dry:"var(--state-climate-dry-color, #00bcd4)",fan_only:"var(--state-climate-fan_only-color, #00acc1)",off:"var(--state-climate-off-color, #8a8a8a)"},zt={heating:"heat",preheating:"heat",cooling:"cool",drying:"dry",fan:"fan_only",defrosting:"cool"},Nt={modes:!0,fan:!0,swing:!0,presets:!0,humidity:!0,sensors:!0,graph:!1,shortcuts:!0,timer:!0,airflow:!0,hints:!0},Ht=["modes","fan","timer","countdown","shortcuts"],Ot=["switch","button"];const Dt={de:{card:{current:"Aktuell",target:"Ziel",humidity:"Luftfeuchte",target_humidity:"Ziel-Luftfeuchte",outdoor:"Außen",power:"Leistung",energy:"Energie",fan:"Lüfter",swing:"Lamellen",swing_horizontal:"Lamellen horizontal",preset:"Voreinstellung",mode:"Modus",history:"Verlauf",window_open:"Fenster offen",window_open_hint:"Ein Fenster ist geöffnet – Klimaanlage ggf. ausschalten.",unavailable:"Nicht verfügbar",entity_not_found:"Entität nicht gefunden",more:"Mehr",less:"Weniger",turn_on:"Einschalten",turn_off:"Ausschalten",no_history:"Keine Verlaufsdaten",shortcuts:"Schalter",sleep_timer:"Sleeptimer",timer_off:"Inaktiv",timer_at:"Aus um",timer_in:"in",ventilate_cool:"Lüften statt Kühlen",ventilate_heat:"Lüften statt Heizen",ventilate_hint:"Fenster öffnen spart Strom.",outside:"Draußen",inside:"drinnen",humidity_high:"Luftfeuchte hoch",mold_hint:"Schimmelgefahr – Entfeuchten oder Lüften empfohlen",dew_point:"Taupunkt",start_dry:"Entfeuchten",today:"Heute",countdown:"Ausschalten in",cancel:"Abbrechen",error:"Befehl fehlgeschlagen",syncing:"Wird übertragen …",eta:"Ziel in ca.",runtime_today:"Laufzeit heute",until:"bis"},hvac_mode:{off:"Aus",heat:"Heizen",cool:"Kühlen",heat_cool:"Heizen/Kühlen",auto:"Automatisch",dry:"Entfeuchten",fan_only:"Nur Lüfter"},hvac_action:{off:"Aus",heating:"Heizt",cooling:"Kühlt",drying:"Entfeuchtet",idle:"Leerlauf",fan:"Lüftet",preheating:"Vorheizen",defrosting:"Abtauen"},editor:{entity:"Klima-Entität",name:"Name",icon:"Symbol",layout:"Layout",layout_full:"Voll (Drehregler)",layout_compact:"Kompakt (Kachel)",sections:"Sichtbare Bereiche",show_modes:"Betriebsmodi",show_fan:"Lüfterstufen",show_swing:"Lamellen",show_presets:"Voreinstellungen",show_humidity:"Ziel-Luftfeuchte",show_sensors:"Sensoren",show_graph:"Verlaufsgraph",sensors:"Zusätzliche Sensoren",temperature_sensor:"Ist-Temperatur: Sensor oder Thermostat (leer = Klimaanlage)",humidity_sensor:"Raumluftfeuchte-Sensor",outdoor_sensor:"Außentemperatur-Sensor",power_sensor:"Leistungssensor",energy_sensor:"Energiesensor",window_sensor:"Fenster-/Türkontakt",use_sensor_for_current:"Als Ist-Temperatur verwenden (aus = nur als Kachel)",graph_hours:"Zeitraum Graph (Stunden)",show_shortcuts:"Schalter-Buttons",shortcuts_section:"Schalter-Buttons",shortcuts:"Entitäten (Schalter, Skripte, Szenen, Buttons)",auto_shortcuts:"Schalter des Geräts automatisch übernehmen",appearance:"Darstellung",expandable:"Details ausklappbar (volles Layout)",start_expanded:"Anfangs ausgeklappt",dropdown_threshold:"Dropdown ab so vielen Optionen (0 = immer Chips)",show_timer:"Sleeptimer",timer_section:"Sleeptimer",timer_switch:"Schalter zum Scharfschalten (input_boolean)",timer_time:"Ausschaltzeit (input_datetime)",show_airflow:"Luftstrom-Animation",show_hints:"Hinweise (Lüften, Taupunkt, Schimmel)",weather_entity:"Wetter (Vorhersage heute)",countdown_timer:"Schnell-Timer (timer-Helfer)",countdown_durations:"Timer-Dauern in Minuten (z.B. 30, 60, 90)",ventilation_delta:"Lüften-Hinweis ab Temperaturdifferenz (°)",humidity_warning:"Schimmel-Warnung ab Luftfeuchte (%, 0 = aus)",hints_section:"Hinweise & Wetter",animations:"Animationen",anim_full:"Voll",anim_reduced:"Reduziert (für Wandtablets)",anim_off:"Aus",power_threshold:"Leerlauf unter Leistung (W)"},overview:{title:"Klimaanlagen",of:"von",running:"aktiv",all_off:"Alle aus",editor_title:"Titel",editor_entities:"Klimageräte",editor_show_all_off:"„Alle aus“-Button",editor_show_controls:"Temperatur-Regler"},values:{auto:"Auto",low:"Niedrig",medium_low:"Mittel-niedrig",medium:"Mittel",medium_high:"Mittel-hoch",high:"Hoch",middle:"Mittel",turbo:"Turbo",quiet:"Leise",silent:"Leise",diffuse:"Diffus",focus:"Fokussiert",top:"Maximal",lowest:"Niedrigste",highest:"Höchste",strong:"Stark",powerful:"Kraftvoll",on:"An",off:"Aus",vertical:"Vertikal",horizontal:"Horizontal",both:"Beide",default:"Standard",full_swing:"Voll schwenkend",fixed_upper:"Oben fest",fixed_upper_middle:"Oben-Mitte fest",fixed_middle:"Mitte fest",fixed_lower_middle:"Unten-Mitte fest",fixed_lower:"Unten fest",swing_upper:"Oben schwenkend",swing_upper_middle:"Oben-Mitte schwenkend",swing_middle:"Mitte schwenkend",swing_lower_middle:"Unten-Mitte schwenkend",swing_lower:"Unten schwenkend",left:"Links",left_center:"Links-Mitte",center:"Mitte",right_center:"Rechts-Mitte",right:"Rechts",swing:"Schwenken",stop:"Stopp",rangefull:"Voll",none:"Keine",eco:"Eco",away:"Abwesend",boost:"Boost",comfort:"Komfort",home:"Zuhause",sleep:"Schlafen",activity:"Aktivität",night:"Nacht",normal:"Normal",manual:"Manuell",frost_protection:"Frostschutz",holiday:"Urlaub"}},en:{card:{current:"Current",target:"Target",humidity:"Humidity",target_humidity:"Target humidity",outdoor:"Outdoor",power:"Power",energy:"Energy",fan:"Fan",swing:"Swing",swing_horizontal:"Horizontal swing",preset:"Preset",mode:"Mode",history:"History",window_open:"Window open",window_open_hint:"A window is open – consider turning off the air conditioner.",unavailable:"Unavailable",entity_not_found:"Entity not found",more:"More",less:"Less",turn_on:"Turn on",turn_off:"Turn off",no_history:"No history data",shortcuts:"Shortcuts",sleep_timer:"Sleep timer",timer_off:"Inactive",timer_at:"Off at",timer_in:"in",ventilate_cool:"Ventilate instead of cooling",ventilate_heat:"Ventilate instead of heating",ventilate_hint:"Opening a window saves energy.",outside:"Outside",inside:"inside",humidity_high:"High humidity",mold_hint:"Risk of mould – dehumidify or ventilate",dew_point:"Dew point",start_dry:"Dehumidify",today:"Today",countdown:"Turn off in",cancel:"Cancel",error:"Command failed",syncing:"Sending …",eta:"Target in approx.",runtime_today:"Runtime today",until:"until"},hvac_mode:{off:"Off",heat:"Heat",cool:"Cool",heat_cool:"Heat/Cool",auto:"Auto",dry:"Dry",fan_only:"Fan only"},hvac_action:{off:"Off",heating:"Heating",cooling:"Cooling",drying:"Drying",idle:"Idle",fan:"Fan",preheating:"Preheating",defrosting:"Defrosting"},editor:{entity:"Climate entity",name:"Name",icon:"Icon",layout:"Layout",layout_full:"Full (dial)",layout_compact:"Compact (tile)",sections:"Visible sections",show_modes:"HVAC modes",show_fan:"Fan modes",show_swing:"Swing modes",show_presets:"Presets",show_humidity:"Target humidity",show_sensors:"Sensors",show_graph:"History graph",sensors:"Additional sensors",temperature_sensor:"Current temperature: sensor or thermostat (empty = air conditioner)",humidity_sensor:"Room humidity sensor",outdoor_sensor:"Outdoor temperature sensor",power_sensor:"Power sensor",energy_sensor:"Energy sensor",window_sensor:"Window / door contact",use_sensor_for_current:"Use as current temperature (off = tile only)",graph_hours:"Graph period (hours)",show_shortcuts:"Shortcut buttons",shortcuts_section:"Shortcut buttons",shortcuts:"Entities (switches, scripts, scenes, buttons)",auto_shortcuts:"Automatically add the device's switches",appearance:"Appearance",expandable:"Collapsible details (full layout)",start_expanded:"Start expanded",dropdown_threshold:"Dropdown from this many options (0 = always chips)",show_timer:"Sleep timer",timer_section:"Sleep timer",timer_switch:"Arming switch (input_boolean)",timer_time:"Off time (input_datetime)",show_airflow:"Airflow animation",show_hints:"Hints (ventilation, dew point, mould)",weather_entity:"Weather (today's forecast)",countdown_timer:"Quick timer (timer helper)",countdown_durations:"Timer durations in minutes (e.g. 30, 60, 90)",ventilation_delta:"Ventilation hint from temperature difference (°)",humidity_warning:"Mould warning from humidity (%, 0 = off)",hints_section:"Hints & weather",animations:"Animations",anim_full:"Full",anim_reduced:"Reduced (for wall tablets)",anim_off:"Off",power_threshold:"Idle below power (W)"},overview:{title:"Air conditioners",of:"of",running:"running",all_off:"All off",editor_title:"Title",editor_entities:"Climate entities",editor_show_all_off:'"All off" button',editor_show_controls:"Temperature controls"},values:{auto:"Auto",low:"Low",medium_low:"Medium low",medium:"Medium",medium_high:"Medium high",high:"High",middle:"Middle",turbo:"Turbo",quiet:"Quiet",silent:"Silent",diffuse:"Diffuse",focus:"Focus",top:"Top",lowest:"Lowest",highest:"Highest",strong:"Strong",powerful:"Powerful",on:"On",off:"Off",vertical:"Vertical",horizontal:"Horizontal",both:"Both",default:"Default",full_swing:"Full swing",fixed_upper:"Fixed upper",fixed_upper_middle:"Fixed upper-middle",fixed_middle:"Fixed middle",fixed_lower_middle:"Fixed lower-middle",fixed_lower:"Fixed lower",swing_upper:"Swing upper",swing_upper_middle:"Swing upper-middle",swing_middle:"Swing middle",swing_lower_middle:"Swing lower-middle",swing_lower:"Swing lower",left:"Left",left_center:"Left-center",center:"Center",right_center:"Right-center",right:"Right",swing:"Swing",stop:"Stop",rangefull:"Full range",none:"None",eco:"Eco",away:"Away",boost:"Boost",comfort:"Comfort",home:"Home",sleep:"Sleep",activity:"Activity",night:"Night",normal:"Normal",manual:"Manual",frost_protection:"Frost protection",holiday:"Holiday"}}},Pt=(t,e)=>{let i=Dt[t];for(const t of e.split(".")){if(null==i||"object"!=typeof i)return;i=i[t]}return"string"==typeof i?i:void 0},Lt=t=>{const e=(t?.locale?.language??t?.language??navigator.language??"en").split("-")[0].toLowerCase();return e in Dt?e:"en"},Ft=(t,e)=>Pt(Lt(t),e)??Pt("en",e)??e,It=t=>t.replace(/_/g," ").replace(/^\w/,t=>t.toUpperCase()),Ut=(t,e,i,s)=>{if(t.formatEntityAttributeValue){const n=t.formatEntityAttributeValue(e,i,s);if(n&&n!==s)return n}const n=Lt(t);if("hvac_action"===i)return Pt(n,`hvac_action.${s}`)??It(s);const o=`values.${String(s).trim().toLowerCase().replace(/[\s-]+/g,"_")}`;return Pt(n,o)??It(s)},Rt=(t,e,i)=>{if(t.formatEntityState){const s=t.formatEntityState(e,i);if(s&&s!==i)return s}return Pt(Lt(t),`hvac_mode.${i}`)??It(i)},jt=r`
  :host { display: block; }
  ha-card {
    --accent: var(--hcc-accent-c, var(--primary-color));
    --ease-out: cubic-bezier(0.22, 1, 0.36, 1);
    --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
    position: relative; overflow: hidden; padding: 16px; box-sizing: border-box; height: 100%;
    display: flex; flex-direction: column; gap: 14px;
    transition: --hcc-accent-c 0.7s ease, background 0.4s; isolation: isolate;
    font-variant-numeric: tabular-nums;
    --hcc-inner-radius: calc(var(--ha-card-border-radius, 16px) * 0.85);
  }
  /* animations: reduced → keine Daueranimationen; off → zusätzlich keine Übergänge */
  ha-card.anim-reduced, ha-card.anim-off { --hcc-anim-state: paused; }
  ha-card.anim-reduced .blob, ha-card.anim-off .blob,
  ha-card.anim-reduced .icon-badge ha-icon, ha-card.anim-off .icon-badge ha-icon,
  ha-card.anim-reduced .icon-badge::after, ha-card.anim-off .icon-badge::after { animation: none !important; }
  ha-card.anim-off, ha-card.anim-off .collapsible, ha-card.anim-off .banner { transition: none !important; animation: none !important; }
  .graph-placeholder { height: 80px; border-radius: var(--hcc-inner-radius, 12px); background: rgba(127,127,127,0.08); }

  /* Hintergrund-Glow: zwei weiche, langsam treibende Farbflächen in der Modusfarbe */
  .glow { position: absolute; inset: 0; pointer-events: none; z-index: -1; overflow: hidden; }
  .blob {
    position: absolute; border-radius: 50%; will-change: transform, opacity;
    transition: opacity 0.8s ease;
  }
  .b1 {
    width: 115%; aspect-ratio: 1; left: -8%; top: -62%;
    background: radial-gradient(closest-side, color-mix(in srgb, var(--accent) 30%, transparent), transparent 72%);
    animation: drift1 18s ease-in-out infinite;
  }
  .b2 {
    width: 80%; aspect-ratio: 1; right: -38%; top: -18%;
    background: radial-gradient(closest-side, color-mix(in srgb, var(--accent) 18%, color-mix(in srgb, #fff 6%, transparent)), transparent 70%);
    animation: drift2 23s ease-in-out infinite;
  }
  ha-card.idle .blob { opacity: 0.55; animation-play-state: paused; }
  ha-card.off .blob, ha-card.unavailable .blob { opacity: 0.25; animation-play-state: paused; }
  ha-card.compact .b1 { width: 80%; left: auto; right: -25%; top: -90%; }
  ha-card.compact .b2 { width: 55%; right: auto; left: -20%; top: 20%; }
  @keyframes drift1 { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(6%, 4%) scale(1.08); } }
  @keyframes drift2 { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(-10%, 8%) scale(0.92); } }
  button { font: inherit; color: inherit; }

  /* Header */
  .header { position: relative; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .title {
    display: flex; align-items: center; gap: 12px; background: none; border: none; padding: 0;
    cursor: pointer; text-align: left; min-width: 0;
  }
  .icon-badge {
    position: relative; flex: none; width: 42px; height: 42px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
    background: color-mix(in srgb, var(--accent) 20%, transparent); color: var(--accent);
  }
  .icon-badge::after {
    content: ""; position: absolute; inset: 0; border-radius: 50%; pointer-events: none;
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--accent) 45%, transparent); opacity: 0;
  }
  .icon-badge.active::after { animation: ring 2.6s ease-out infinite; }
  /* Symbole mit Charakter je nach Tätigkeit */
  .icon-badge.active ha-icon { animation: breathe 2.4s ease-in-out infinite; }
  .icon-badge.active[data-action="cooling"] ha-icon,
  .icon-badge.active[data-action="defrosting"] ha-icon { animation: spin 9s linear infinite; }
  .icon-badge.active[data-action="fan"] ha-icon { animation: spin 1.6s linear infinite; }
  .icon-badge.active[data-action="heating"] ha-icon,
  .icon-badge.active[data-action="preheating"] ha-icon { animation: flicker 1.8s ease-in-out infinite; transform-origin: 50% 85%; }
  .icon-badge.active[data-action="drying"] ha-icon { animation: bob 2s ease-in-out infinite; }
  @keyframes ring { 0% { opacity: 1; box-shadow: 0 0 0 0 color-mix(in srgb, var(--accent) 45%, transparent); }
    100% { opacity: 0; box-shadow: 0 0 0 10px color-mix(in srgb, var(--accent) 0%, transparent); } }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes flicker { 0%, 100% { transform: scale(1) rotate(0); } 25% { transform: scale(1.08, 0.95) rotate(-3deg); }
    50% { transform: scale(0.96, 1.07) rotate(2deg); } 75% { transform: scale(1.05, 0.97) rotate(-1deg); } }
  @keyframes bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
  .names { display: flex; flex-direction: column; min-width: 0; }
  .name { font-size: 16px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .status { font-size: 13px; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .power {
    flex: none; width: 42px; height: 42px; border-radius: 50%; border: none; cursor: pointer;
    background: rgba(127,127,127,0.12); color: var(--secondary-text-color);
    display: flex; align-items: center; justify-content: center;
    transition: background 0.3s, color 0.3s, box-shadow 0.4s, transform 0.2s var(--ease-spring);
  }
  .power:hover { transform: scale(1.06); }
  .power:active { transform: scale(0.92); }
  .power.on { background: var(--accent); color: var(--text-primary-color, #fff);
    box-shadow: 0 4px 14px color-mix(in srgb, var(--accent) 45%, transparent), inset 0 1px 0 rgba(255,255,255,0.25); }
  .power:focus-visible, .title:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

  /* Window banner */
  .banner {
    animation: slide-in 0.45s var(--ease-out) both;
    position: relative; display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: var(--hcc-inner-radius, 12px); cursor: pointer;
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
  .banner.error { background: color-mix(in srgb, var(--error-color, #db4437) 16%, transparent); }
  .banner.error ha-icon { color: var(--error-color, #db4437); }
  .sync { display: inline-block; width: 7px; height: 7px; border-radius: 50%; margin-right: 6px; vertical-align: middle;
    background: var(--accent); animation: sync 1s ease-in-out infinite; }
  @keyframes sync { 0%, 100% { opacity: 0.25; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1.1); } }
  .hints { position: relative; display: flex; flex-direction: column; gap: 8px; }
  @keyframes slide-in { from { opacity: 0; transform: translateY(-6px) scale(0.98); } to { opacity: 1; transform: none; } }

  /* Ausklappbarer Bereich */
  .collapsible { display: grid; grid-template-rows: 0fr; opacity: 0; margin-top: -14px;
    transition: grid-template-rows 0.45s var(--ease-out), opacity 0.3s ease, margin-top 0.45s var(--ease-out); }
  .collapsible.open { grid-template-rows: 1fr; opacity: 1; margin-top: 0; }
  .collapsible-inner { min-height: 0; overflow: hidden; }
  .collapsible-inner > .controls { padding-top: 2px; padding-bottom: 2px; }
  .expand .chevron { transition: transform 0.35s var(--ease-out); }
  .expand[aria-expanded="true"] .chevron { transform: rotate(180deg); }


  /* Dial */
  .dial-center { display: flex; flex-direction: column; align-items: center; gap: 2px; }
  .dial-label { font-size: 13px; color: var(--secondary-text-color); text-transform: uppercase; letter-spacing: 0.06em; }
  .dial-big { display: inline-block; font-size: clamp(40px, 13vw, 58px); font-weight: 300; line-height: 1; letter-spacing: -0.02em; }
  .dial-big sup, .big sup { font-size: 0.4em; font-weight: 400; vertical-align: top; margin-left: 2px; position: relative; top: 0.25em; }
  .dial-range { font-size: clamp(28px, 9vw, 38px); font-weight: 400; display: flex; gap: 6px; align-items: baseline; }
  .dial-range .sep { color: var(--secondary-text-color); font-size: 0.7em; }
  .dial-sub { display: flex; align-items: center; gap: 4px; font-size: 14px; color: var(--secondary-text-color); margin-top: 4px; }
  .dial-sub ha-icon { --mdc-icon-size: 16px; margin-left: 4px; }
  .dial-sub span { transition: color 0.6s; }
  .eta { display: flex; align-items: center; gap: 3px; margin-top: 4px; font-size: 12px; font-weight: 500; color: var(--accent);
    padding: 2px 8px; border-radius: 999px; background: color-mix(in srgb, var(--accent) 12%, transparent); animation: slide-in 0.5s var(--ease-out) both; }
  .eta ha-icon { --mdc-icon-size: 14px; }
  .compact-eta { align-self: flex-start; margin: -8px 0 0 2px; }
  .big { transition: color 0.6s; }
  .pills { position: relative; display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; margin-top: -6px; }
  .pills::-webkit-scrollbar { display: none; }
  .pill { flex: none; display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px 3px 7px; border-radius: 999px;
    font-size: 12px; font-weight: 500; color: var(--primary-text-color);
    background: color-mix(in srgb, var(--accent) 12%, rgba(127,127,127,0.08));
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 22%, transparent); animation: slide-in 0.4s var(--ease-out) both; }
  .pill ha-icon { --mdc-icon-size: 14px; color: var(--accent); }
  .dial-steppers { display: flex; justify-content: center; gap: 16px; margin-top: -24px; position: relative; flex-wrap: wrap; }
  .dial-steppers.dual { gap: 8px; margin-top: -8px; }
  hcc-climate-dial { margin-bottom: -16px; }
  .round {
    width: 48px; height: 48px; border-radius: 50%; border: none; cursor: pointer;
    background: color-mix(in srgb, var(--accent) 8%, rgba(127,127,127,0.12)); display: flex; align-items: center; justify-content: center;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.12), 0 1px 2px rgba(0,0,0,0.06);
    transition: background 0.25s, transform 0.25s var(--ease-spring), box-shadow 0.25s;
  }
  .round:hover { background: color-mix(in srgb, var(--accent) 22%, transparent); transform: translateY(-1px);
    box-shadow: 0 6px 16px color-mix(in srgb, var(--accent) 25%, transparent); }
  .round:active { transform: scale(0.9); transition-duration: 0.08s; }
  .round:focus-visible, .stepper button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

  /* Stepper */
  .stepper {
    display: inline-flex; align-items: center; gap: 4px; padding: 4px; border-radius: 999px;
    background: rgba(127,127,127,0.12);
  }
  .stepper button, .round { touch-action: manipulation; -webkit-user-select: none; user-select: none; }
  .stepper button {
    width: 34px; height: 34px; border-radius: 50%; border: none; cursor: pointer; background: transparent;
    display: flex; align-items: center; justify-content: center; color: var(--accent, var(--primary-text-color));
    transition: background 0.2s, transform 0.25s var(--ease-spring);
  }
  .stepper button:hover { background: color-mix(in srgb, var(--accent, #888) 20%, transparent); }
  .stepper button:active { transform: scale(0.86); transition-duration: 0.08s; }
  .stepper-value { display: inline-block; min-width: 54px; text-align: center; font-size: 18px; font-weight: 600; }
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
  /* Kompakt-Skala */
  .gauge { position: relative; height: 18px; margin: -2px 6px 0; }
  .gauge > span { position: absolute; top: 50%; transform: translateY(-50%); }
  .g-track { left: 0; right: 0; height: 6px; border-radius: 3px;
    background: color-mix(in srgb, var(--accent) 10%, rgba(127,127,127,0.2)); }
  .g-zone { height: 6px; border-radius: 3px; opacity: 0.55; }
  .g-seg { height: 6px; border-radius: 3px; background: linear-gradient(90deg, var(--c1), var(--c2));
    box-shadow: 0 0 10px color-mix(in srgb, var(--accent) 45%, transparent); transition: left 0.5s var(--ease-out), right 0.5s var(--ease-out); }
  .g-seg.flowing { background-image: repeating-linear-gradient(90deg, rgba(255,255,255,0.45) 0 2px, transparent 2px 12px), linear-gradient(90deg, var(--c1), var(--c2));
    background-size: 12px 100%, 100% 100%; animation: g-flow 0.9s linear infinite; animation-play-state: var(--hcc-anim-state, running); }
  .g-seg.flowing.down { animation-direction: reverse; }
  @keyframes g-flow { from { background-position: 0 0, 0 0; } to { background-position: 12px 0, 0 0; } }
  .g-cur { width: 8px; height: 8px; margin-left: -4px; border-radius: 50%; background: var(--card-background-color, #fff);
    box-shadow: 0 0 0 2.5px var(--secondary-text-color); transition: left 0.5s var(--ease-out); }
  .g-knob { width: 14px; height: 14px; margin-left: -7px; border-radius: 50%; background: #fff; box-shadow: 0 0 0 3px var(--k),
    0 2px 8px color-mix(in srgb, var(--k) 55%, transparent); transition: left 0.5s var(--ease-spring); }
  .compact-steppers { display: flex; gap: 6px; flex-wrap: wrap; }
  .expand {
    position: relative; align-self: center; display: flex; align-items: center; gap: 2px; border: none; background: none;
    color: var(--secondary-text-color); cursor: pointer; font-size: 12px; padding: 2px 8px; border-radius: 999px; margin: -6px 0;
  }
  .expand:hover { background: rgba(127,127,127,0.12); }

  .warning { padding: 8px; color: var(--error-color, #db4437); }
  ha-card.unavailable { opacity: 0.6; }

  @keyframes breathe { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.12); } }
  @media (prefers-reduced-motion: reduce) {
    .icon-badge.active ha-icon, .icon-badge.active::after, .blob, .banner { animation: none !important; }
    .collapsible, ha-card { transition: none !important; }
  }
`,Bt=["switch","input_boolean","light","fan","automation","siren","humidifier"],Vt={switch:"mdi:toggle-switch-variant",input_boolean:"mdi:toggle-switch-variant",light:"mdi:lightbulb",fan:"mdi:fan",script:"mdi:script-text-play",scene:"mdi:palette",button:"mdi:gesture-tap-button",input_button:"mdi:gesture-tap-button",automation:"mdi:robot"},Wt=[[/licht|light|panel|display|led/i,"mdi:lightbulb-outline"],[/leise|quiet|silent/i,"mdi:volume-off"],[/frisch|fresh|air/i,"mdi:air-filter"],[/xfan|x-fan|zusatz|dry/i,"mdi:fan-plus"],[/health|ion|plasma/i,"mdi:shimmer"],[/turbo|boost|power/i,"mdi:rocket-launch-outline"],[/sleep|schlaf/i,"mdi:sleep"],[/timer/i,"mdi:timer-outline"]],Kt=(t,e,i)=>{if(t?.attributes.icon)return t.attributes.icon;const s=Wt.find(([t])=>t.test(e)||t.test(i));return s?.[1]??Vt[e.split(".")[0]]??"mdi:gesture-tap"};let Gt=class extends lt{constructor(){super(...arguments),this.items=[]}_activate(t){if(!this.hass)return;window.dispatchEvent(new CustomEvent("haptic",{detail:"light"}));const e=t.entity.split(".")[0],i={entity_id:t.entity};Bt.includes(e)?this.hass.callService("homeassistant","toggle",i):"button"===e||"input_button"===e?this.hass.callService(e,"press",i):"script"===e||"scene"===e?this.hass.callService(e,"turn_on",i):this.hass.callService("homeassistant","toggle",i)}_moreInfo(t,e){t.preventDefault(),this.dispatchEvent(new CustomEvent("hass-more-info",{detail:{entityId:e},bubbles:!0,composed:!0}))}_icon(t,e){return!t.icon&&e&&customElements.get("ha-state-icon")?V`<ha-state-icon .hass=${this.hass} .stateObj=${e}></ha-state-icon>`:V`<ha-icon .icon=${t.icon??Kt(e,t.entity,t.name)}></ha-icon>`}render(){if(!this.hass||!this.items.length)return G;const t=this.hass.locale?.language??this.hass.language;return V`<div class="row" lang=${t}>
      ${this.items.map(t=>{const e=this.hass.states[t.entity],i="on"===e?.state,s=!e||"unavailable"===e.state;return V`<button class="sc ${i?"on":""}" ?disabled=${s} title=${t.name}
          aria-pressed=${Bt.includes(t.entity.split(".")[0])?String(i):G}
          @click=${()=>this._activate(t)} @contextmenu=${e=>this._moreInfo(e,t.entity)}>
          ${this._icon(t,e)}
          <span>${t.name}</span>
        </button>`})}
    </div>`}};Gt.styles=r`
    .row { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 8px; }
    .sc {
      display: flex; align-items: center; gap: 10px; padding: 8px 10px; min-height: 48px; border: none; text-align: left;
      border-radius: var(--hcc-inner-radius, 14px); background: var(--hcc-chip-bg, rgba(127,127,127,0.12)); color: var(--secondary-text-color);
      font: inherit; font-size: 13px; cursor: pointer; transition: background 0.25s, color 0.25s, box-shadow 0.3s, transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1); min-width: 0;
    }
    .sc span { max-width: 100%; line-height: 1.25; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; -webkit-hyphens: auto; hyphens: auto; }
    .sc:hover { background: rgba(127,127,127,0.2); }
    .sc:active { transform: scale(0.95); }
    .sc.on { background: color-mix(in srgb, var(--hcc-accent, var(--primary-color)) 22%, transparent); color: var(--hcc-accent, var(--primary-color));
      box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--hcc-accent, var(--primary-color)) 30%, transparent); }
    .sc.on ha-icon, .sc.on ha-state-icon { filter: drop-shadow(0 0 6px color-mix(in srgb, var(--hcc-accent, var(--primary-color)) 60%, transparent)); }
    .sc:focus-visible { outline: 2px solid var(--hcc-accent, var(--primary-color)); outline-offset: 2px; }
    .sc:disabled { opacity: 0.4; cursor: default; }
    ha-icon, ha-state-icon { --mdc-icon-size: 22px; flex: none; }
  `,t([mt({attribute:!1})],Gt.prototype,"hass",void 0),t([mt({attribute:!1})],Gt.prototype,"items",void 0),Gt=t([dt("hcc-shortcut-row")],Gt);const qt=135,Yt=270,Zt=82,Xt=(t,e=Zt)=>{const i=t*Math.PI/180;return{x:100+e*Math.cos(i),y:100+e*Math.sin(i)}},Jt=(t,e,i=Zt)=>{if(e-t<.01)return"";const s=Xt(t,i),n=Xt(e,i),o=e-t>180?1:0;return`M ${s.x} ${s.y} A ${i} ${i} 0 ${o} 1 ${n.x} ${n.y}`};let Qt=class extends lt{constructor(){super(...arguments),this.min=16,this.max=30,this.step=.5,this.dual=!1,this.disabled=!1,this.color="var(--primary-color)",this.lowColor="var(--state-climate-heat-color, #ff6d00)",this.highColor="var(--state-climate-cool-color, #2196f3)",this.active=!1,this.fade=!1,this.showCurrentLabel=!0}_clamp(t){const e=Math.round((t-this.min)/this.step)*this.step+this.min,i=Number(e.toFixed(this.step<1?1:0));return Math.min(this.max,Math.max(this.min,i))}_toAngle(t){const e=this.max-this.min||1,i=Math.min(1,Math.max(0,(t-this.min)/e));return qt+Yt*i}_fromPointer(t){const e=this.shadowRoot.querySelector("svg").getBoundingClientRect(),i=(t.clientX-e.left)/e.width*200-100,s=(t.clientY-e.top)/e.height*200-100;let n=(180*Math.atan2(s,i)/Math.PI-qt+720)%360;return n>Yt&&(n=n>315?0:Yt),this._clamp(this.min+n/Yt*(this.max-this.min))}_pickHandle(t){if(!this.dual)return"value";const e=this.low??this.min,i=this.high??this.max;return t<=e?"low":t>=i?"high":t-e<i-t?"low":"high"}_apply(t,e){"value"===t?this.value=e:"low"===t?this.low=Math.min(e,this.high??this.max):this.high=Math.max(e,this.low??this.min)}_emit(t){const e=this.dual?{low:this.low,high:this.high}:{value:this.value};this.dispatchEvent(new CustomEvent(t,{detail:e,bubbles:!0,composed:!0}))}_onPointerDown(t){if(this.disabled)return;t.preventDefault();const e=this._fromPointer(t);this._dragging=this._pickHandle(e),t.currentTarget.setPointerCapture(t.pointerId),this._apply(this._dragging,e),this._emit("value-changing")}_onPointerMove(t){this._dragging&&(this._apply(this._dragging,this._fromPointer(t)),this._emit("value-changing"))}_onPointerUp(t){this._dragging&&(t.currentTarget.releasePointerCapture?.(t.pointerId),this._dragging=void 0,this._emit("value-changed"))}_onKey(t,e){if(this.disabled)return;const i={ArrowUp:this.step,ArrowRight:this.step,ArrowDown:-this.step,ArrowLeft:-this.step,PageUp:5*this.step,PageDown:5*-this.step};if(!(e.key in i))return;e.preventDefault();const s="value"===t?this.value:"low"===t?this.low:this.high;this._apply(t,this._clamp((s??this.min)+i[e.key])),this._emit("value-changed")}_handle(t,e,i){if(null==e)return G;const s=Xt(this._toAngle(e));return W`
      <g class="handle ${this._dragging===t?"dragging":""}" tabindex=${this.disabled?-1:0}
        role="slider" aria-valuemin=${this.min} aria-valuemax=${this.max} aria-valuenow=${e}
        aria-label=${t} @keydown=${e=>this._onKey(t,e)}>
        <circle cx=${s.x} cy=${s.y} r="14" class="halo" style="fill:${i}"></circle>
        <circle cx=${s.x} cy=${s.y} r="9" class="knob"
          style="stroke:${i};filter:drop-shadow(0 2px 6px color-mix(in srgb, ${i} 55%, transparent))"></circle>
      </g>`}_gradientArc(t,e,i,s,n="delta"){const o=e-t;if(o<.5)return G;const r=Math.max(2,Math.ceil(o/2)),a=o/r,c=Array.from({length:r},(n,o)=>{const c=t+o*a,l=Math.min(e,c+a+(o<r-1?.6:0)),h=((o+.5)/r*100).toFixed(1);return W`<path d=${Jt(c,l)} style="stroke:color-mix(in srgb, ${s} ${h}%, ${i})"></path>`}),l=Xt(t),h=Xt(e);return W`<g class=${n}>
      <circle cx=${l.x} cy=${l.y} r="7" style="fill:${i}"></circle>
      <circle cx=${h.x} cy=${h.y} r="7" style="fill:${s}"></circle>
      ${c}
    </g>`}_currentColor(t){return this.fade?`color-mix(in srgb, ${this.color} 25%, transparent)`:(this.current??t)>t?this.lowColor:this.highColor}_flow(t,e){if(!this.active)return G;const i=this._toAngle(t),s=this._toAngle(e);if(Math.abs(s-i)<4)return G;return W`<path class="flow ${s>i?"up":"down"}" d=${Jt(Math.min(i,s),Math.max(i,s))}></path>`}_deltaArc(t){if(null==this.current)return G;const e=Math.min(this.max,Math.max(this.min,this.current)),i=this._toAngle(e),s=this._toAngle(t),n=this._currentColor(t),o=i<s?this._gradientArc(i,s,n,this.color):this._gradientArc(s,i,this.color,n);return W`${o}${this._flow(e,t)}`}render(){let t=G;if(!this.disabled)if(this.dual&&null!=this.low&&null!=this.high){const e=W`<path class="zone" d=${Jt(this._toAngle(this.low),this._toAngle(this.high))}
          style="stroke:url(#rangeGrad)"></path>`;let i=G;null!=this.current&&this.current<this.low?i=W`${this._gradientArc(this._toAngle(Math.max(this.min,this.current)),this._toAngle(this.low),this.highColor,this.lowColor)}${this._flow(this.current,this.low)}`:null!=this.current&&this.current>this.high&&(i=W`${this._gradientArc(this._toAngle(this.high),this._toAngle(Math.min(this.max,this.current)),this.highColor,this.lowColor)}${this._flow(this.current,this.high)}`),t=W`${e}${i}`}else null!=this.value&&(t=null!=this.current?this._deltaArc(this.value):W`<path class="active" d=${Jt(qt,this._toAngle(this.value))} style="stroke:${this.color}"></path>`);const e=null!=this.current?Math.min(this.max,Math.max(this.min,this.current)):void 0,i=null!=e?this._toAngle(e):void 0,s=null!=i?Xt(i,Zt):void 0,n=null!=i?Xt(i,62):void 0,o=this.dual?void 0:this.value,r=this.disabled||null==o?"var(--secondary-text-color)":this._currentColor(o),a=Array.from({length:55},(t,e)=>qt+5*e);let c;if(!this.disabled)if(this.dual&&null!=this.low&&null!=this.high)c={from:this._toAngle(this.low),to:this._toAngle(this.high),cFrom:this.lowColor,cTo:this.highColor,dir:0};else if(null!=o&&null!=i){const t=this._toAngle(o),e=this._currentColor(o);c=i<t?{from:i,to:t,cFrom:e,cTo:this.color,dir:1}:{from:t,to:i,cFrom:this.color,cTo:e,dir:-1}}return V`
      <div class="dial ${this.active?"is-active":""}" style="--dial-color:${this.color}">
        <svg viewBox="0 0 200 200"
          @pointerdown=${this._onPointerDown} @pointermove=${this._onPointerMove}
          @pointerup=${this._onPointerUp} @pointercancel=${this._onPointerUp}>
          <defs>
            <linearGradient id="rangeGrad" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0%" stop-color=${this.lowColor}></stop>
              <stop offset="100%" stop-color=${this.highColor}></stop>
            </linearGradient>
            <filter id="arcGlow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="5"></feGaussianBlur>
            </filter>
          </defs>
          ${a.map((t,e)=>{const i=c&&t>=c.from-.01&&t<=c.to+.01,s=Xt(t,98),n=Xt(t,i?92:94);if(!i||!c)return W`<line class="tick" x1=${s.x} y1=${s.y} x2=${n.x} y2=${n.y}></line>`;const o=c.to-c.from<.01?100:(t-c.from)/(c.to-c.from)*100,r=c.dir>=0?e:a.length-e;return W`<line class="tick lit" x1=${s.x} y1=${s.y} x2=${n.x} y2=${n.y}
              style="stroke:color-mix(in srgb, ${c.cTo} ${o.toFixed(0)}%, ${c.cFrom});animation-delay:${(.06*r).toFixed(2)}s"></line>`})}
          <path class="track" d=${Jt(qt,405)}
            style=${this.disabled?"":`stroke:color-mix(in srgb, ${this.color} 10%, var(--hcc-track, rgba(127,127,127,0.22)))`}></path>
          ${this.disabled?G:W`<g class="glow-layer" filter="url(#arcGlow)">${t}</g>`}
          ${t}
          ${s&&n&&null!=e?W`
            <circle class="current" cx=${s.x} cy=${s.y} r="5.5" style="stroke:${r}"></circle>
            ${this.showCurrentLabel?W`<text class="current-label" x=${n.x} y=${n.y}>${e.toFixed(this.step<1?1:0)}°</text>`:G}`:G}
          ${this.disabled?G:this.dual?[this._handle("low",this.low,this.lowColor),this._handle("high",this.high,this.highColor)]:this._handle("value",this.value,this.color)}
        </svg>
        <div class="center"><slot></slot></div>
      </div>
    `}};Qt.styles=r`
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
    .tick { stroke: var(--secondary-text-color); stroke-opacity: 0.22; stroke-width: 1.2; stroke-linecap: round; }
    .tick.lit { stroke-opacity: 0.85; stroke-width: 1.8; }
    .is-active .tick.lit { animation: pulse 1.8s ease-in-out infinite; }
    .glow-layer { opacity: 0.5; pointer-events: none; }
    .tick.lit, .glow-layer, .flow, .center::before { animation-play-state: var(--hcc-anim-state, running) !important; }
    .glow-layer .flow { display: none; }
    .is-active .glow-layer { animation: glow 3s ease-in-out infinite; }
    .current { fill: var(--card-background-color, #fff); stroke-width: 3; filter: drop-shadow(0 1px 1.5px rgba(0,0,0,0.3)); }
    .handle { cursor: grab; outline: none; }
    .handle circle { transform-box: fill-box; transform-origin: center; }
    .handle .halo { opacity: 0.12; transform: scale(0.8);
      transition: opacity 0.25s, transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1); }
    .handle:hover .halo, .handle:focus-visible .halo { opacity: 0.25; transform: scale(1); }
    .handle.dragging .halo { opacity: 0.3; transform: scale(1.25); }
    .handle.dragging { cursor: grabbing; }
    .knob { fill: #fff; stroke-width: 4; transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); }
    .handle.dragging .knob { transform: scale(1.15); }
    .center {
      position: absolute; inset: 22%; display: flex; flex-direction: column;
      align-items: center; justify-content: center; text-align: center; pointer-events: none;
    }
    /* Weicher Lichthof hinter der Zahl, atmet solange das Gerät arbeitet */
    .center::before {
      content: ""; position: absolute; inset: -6%; border-radius: 50%; z-index: -1;
      background: radial-gradient(closest-side, color-mix(in srgb, var(--dial-color) 16%, transparent), transparent);
      opacity: 0.8; transition: opacity 0.6s;
    }
    .is-active .center::before { animation: breathe-glow 3.2s ease-in-out infinite; }
    .dial { isolation: isolate; }
    .center ::slotted(*) { pointer-events: auto; }
    @keyframes flow-up { from { stroke-dashoffset: 18; } to { stroke-dashoffset: 0; } }
    @keyframes flow-down { from { stroke-dashoffset: 0; } to { stroke-dashoffset: 18; } }
    @keyframes pulse { 0%, 100% { stroke-opacity: 0.35; } 50% { stroke-opacity: 1; } }
    @keyframes glow { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.75; } }
    @keyframes breathe-glow { 0%, 100% { opacity: 0.6; transform: scale(0.94); } 50% { opacity: 1; transform: scale(1.04); } }
    @media (prefers-reduced-motion: reduce) {
      .is-active .tick, .flow, .is-active .glow-layer, .is-active .center::before { animation: none; }
    }
  `,t([mt({type:Number})],Qt.prototype,"min",void 0),t([mt({type:Number})],Qt.prototype,"max",void 0),t([mt({type:Number})],Qt.prototype,"step",void 0),t([mt({type:Number})],Qt.prototype,"value",void 0),t([mt({type:Number})],Qt.prototype,"low",void 0),t([mt({type:Number})],Qt.prototype,"high",void 0),t([mt({type:Number})],Qt.prototype,"current",void 0),t([mt({type:Boolean})],Qt.prototype,"dual",void 0),t([mt({type:Boolean})],Qt.prototype,"disabled",void 0),t([mt()],Qt.prototype,"color",void 0),t([mt()],Qt.prototype,"lowColor",void 0),t([mt()],Qt.prototype,"highColor",void 0),t([mt({type:Boolean})],Qt.prototype,"active",void 0),t([mt({type:Boolean})],Qt.prototype,"fade",void 0),t([mt({type:Boolean})],Qt.prototype,"showCurrentLabel",void 0),t([ft()],Qt.prototype,"_dragging",void 0),Qt=t([dt("hcc-climate-dial")],Qt);let te=class extends lt{constructor(){super(...arguments),this.modes=[],this.disabled=!1,this._placed=!1}connectedCallback(){super.connectedCallback(),this._resizeObserver=new ResizeObserver(()=>this._placeIndicator(!1)),this._resizeObserver.observe(this)}disconnectedCallback(){super.disconnectedCallback(),this._resizeObserver?.disconnect(),this._placed=!1}updated(){this._placeIndicator(this._placed)}_placeIndicator(t){const e=this._indicator;if(!e)return;const i=this.shadowRoot.querySelector(".mode.on");i?(e.style.transition=t?"":"none",e.style.opacity="1",e.style.width=`${i.offsetWidth}px`,e.style.height=`${i.offsetHeight}px`,e.style.transform=`translate(${i.offsetLeft}px, ${i.offsetTop}px)`,e.style.setProperty("--mode-color",Mt[this.selected??""]??"var(--primary-color)"),t||(e.offsetWidth,e.style.transition=""),this._placed=!0):e.style.opacity="0"}_select(t){this.disabled||t===this.selected||this.dispatchEvent(new CustomEvent("mode-selected",{detail:{mode:t},bubbles:!0,composed:!0}))}render(){return V`<div class="bar" role="radiogroup">
      <span class="indicator" aria-hidden="true"></span>
      ${this.modes.map(t=>V`
        <button class="mode ${t.value===this.selected?"on":""}" role="radio"
          aria-checked=${t.value===this.selected} title=${t.label} aria-label=${t.label}
          ?disabled=${this.disabled} style="--mode-color:${Mt[t.value]??"var(--primary-color)"}"
          @click=${()=>this._select(t.value)}>
          <ha-icon .icon=${Et[t.value]??"mdi:thermostat"}></ha-icon>
        </button>`)}
    </div>`}};te.styles=r`
    .bar { position: relative; display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; }
    .indicator {
      position: absolute; left: 0; top: 0; border-radius: var(--hcc-inner-radius, 14px); pointer-events: none; opacity: 0;
      background: color-mix(in srgb, var(--mode-color) 24%, transparent);
      box-shadow: 0 4px 14px color-mix(in srgb, var(--mode-color) 28%, transparent), inset 0 0 0 1px color-mix(in srgb, var(--mode-color) 35%, transparent);
      transition: transform 0.45s cubic-bezier(0.34, 1.3, 0.64, 1), width 0.3s, background 0.45s, box-shadow 0.45s, opacity 0.2s;
    }
    .mode {
      flex: 1 1 0; min-width: 40px; max-width: 64px; height: 44px; border: none; border-radius: var(--hcc-inner-radius, 14px);
      background: var(--hcc-chip-bg, rgba(127,127,127,0.12)); color: var(--secondary-text-color);
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      transition: background 0.25s, color 0.25s, transform 0.1s;
    }
    .mode:hover { background: rgba(127,127,127,0.2); }
    .mode:active { transform: scale(0.94); }
    .mode { position: relative; z-index: 1; }
    .mode.on, .mode.on:hover { background: transparent; color: var(--mode-color); }
    .mode.on ha-icon { animation: pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1); }
    @keyframes pop { 0% { transform: scale(0.7); } 100% { transform: scale(1); } }
    @media (prefers-reduced-motion: reduce) { .indicator { transition: none; } .mode.on ha-icon { animation: none; } }
    .mode:focus-visible { outline: 2px solid var(--mode-color); outline-offset: 2px; }
    .mode:disabled { cursor: default; opacity: 0.5; }
    ha-icon { --mdc-icon-size: 22px; }
  `,t([mt({attribute:!1})],te.prototype,"modes",void 0),t([mt()],te.prototype,"selected",void 0),t([mt({type:Boolean})],te.prototype,"disabled",void 0),t([_t(".indicator")],te.prototype,"_indicator",void 0),te=t([dt("hcc-mode-bar")],te);const ee="undefined"!=typeof HTMLElement&&"popover"in HTMLElement.prototype;let ie=class extends lt{constructor(){super(...arguments),this.label="",this.options=[],this.disabled=!1,this.dropdownThreshold=6,this._open=!1,this._onViewportChange=t=>{"scroll"===t.type&&this._menu&&t.composedPath().includes(this._menu)||this._close()}}disconnectedCallback(){super.disconnectedCallback(),this._close()}_select(t){this.disabled||t===this.selected||this.dispatchEvent(new CustomEvent("option-selected",{detail:{value:t},bubbles:!0,composed:!0}))}get _useDropdown(){return this.dropdownThreshold>0&&this.options.length>this.dropdownThreshold}_toggleMenu(){this._open?this._close():this._openMenu()}async _openMenu(){if(this.disabled)return;this._open=!0,await this.updateComplete;const t=this._menu;if(!t)return;ee&&(t.showPopover(),this._position(),window.addEventListener("scroll",this._onViewportChange,!0),window.addEventListener("resize",this._onViewportChange));const e=t.querySelector(".option.on")??t.querySelector(".option");e?.focus({preventScroll:!0}),e?.scrollIntoView({block:"nearest"})}_close(t=!1){window.removeEventListener("scroll",this._onViewportChange,!0),window.removeEventListener("resize",this._onViewportChange),ee&&this._menu?.matches(":popover-open")&&this._menu.hidePopover(),this._open=!1,t&&this._trigger?.focus()}_position(){const t=this._trigger,e=this._menu;if(!t||!e)return;const i=t.getBoundingClientRect(),s=window.innerWidth,n=window.innerHeight,o=Math.min(Math.max(i.width,220),s-16),r=n-i.bottom-12,a=i.top-12,c=r<240&&a>r,l=Math.min(340,c?a:r),h=Math.min(Math.max(8,i.right-o),s-o-8);Object.assign(e.style,{width:`${o}px`,maxHeight:`${l}px`,left:`${h}px`,top:c?"auto":`${i.bottom+6}px`,bottom:c?n-i.top+6+"px":"auto"}),e.classList.toggle("up",c)}_onMenuToggle(t){"closed"===t.newState&&this._open&&this._close()}_onMenuKey(t){const e=[...this._menu?.querySelectorAll(".option")??[]],i=e.indexOf(this.shadowRoot.activeElement),s=i=>{t.preventDefault(),e[(i+e.length)%e.length]?.focus()};"ArrowDown"===t.key?s(i+1):"ArrowUp"===t.key?s(i-1):"Home"===t.key?s(0):"End"===t.key?s(e.length-1):"Escape"!==t.key&&"Tab"!==t.key||(t.preventDefault(),this._close(!0))}_pick(t){this._select(t),this._close(!0)}_renderDropdown(){const t=this.options.find(t=>t.value===this.selected),e=V`<div class="menu ${ee?"":"inline"}" role="listbox" aria-label=${this.label}
      popover=${ee?"auto":G} @toggle=${this._onMenuToggle} @keydown=${this._onMenuKey}>
      ${this.options.map(t=>V`
        <button class="option ${t.value===this.selected?"on":""}" role="option"
          aria-selected=${t.value===this.selected} @click=${()=>this._pick(t.value)}>
          <span>${t.label}</span>
          ${t.value===this.selected?V`<ha-icon icon="mdi:check"></ha-icon>`:G}
        </button>`)}
    </div>`;return V`<div class="dropdown-row">
      ${this._renderHead()}
      <button class="trigger ${this._open?"open":""}" ?disabled=${this.disabled} aria-haspopup="listbox"
        aria-expanded=${this._open} aria-label=${this.label} @click=${this._toggleMenu}>
        <span>${t?.label??this.selected??"–"}</span>
        <ha-icon icon="mdi:chevron-down"></ha-icon>
      </button>
    </div>
    ${ee||this._open?e:G}`}_renderHead(){return V`<div class="head">
      ${this.icon?V`<ha-icon .icon=${this.icon}></ha-icon>`:G}
      <span>${this.label}</span>
    </div>`}render(){return this._useDropdown?this._renderDropdown():V`
      <div class="head">
        ${this.icon?V`<ha-icon .icon=${this.icon}></ha-icon>`:G}
        <span>${this.label}</span>
      </div>
      <div class="chips" role="radiogroup" aria-label=${this.label}>
        ${this.options.map(t=>V`
          <button class="chip ${t.value===this.selected?"on":""}" role="radio"
            aria-checked=${t.value===this.selected} ?disabled=${this.disabled}
            @click=${()=>this._select(t.value)}>${t.label}</button>`)}
      </div>`}};ie.styles=r`
    :host { display: block; }
    .head { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 500;
      color: var(--secondary-text-color); margin: 0 2px 6px; text-transform: uppercase; letter-spacing: 0.04em; }
    .head ha-icon { --mdc-icon-size: 16px; }
    .chips { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; padding-bottom: 2px; }
    .chips::-webkit-scrollbar { display: none; }
    .chip {
      flex: 0 0 auto; border: none; border-radius: 999px; padding: 7px 14px; font: inherit; font-size: 13px;
      background: var(--hcc-chip-bg, rgba(127,127,127,0.12)); color: var(--primary-text-color);
      cursor: pointer; transition: background 0.25s, color 0.25s, box-shadow 0.3s, transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    .chip:hover { background: rgba(127,127,127,0.2); }
    .chip.on { background: var(--hcc-accent, var(--primary-color)); color: var(--text-primary-color, #fff);
      box-shadow: 0 3px 10px color-mix(in srgb, var(--hcc-accent, var(--primary-color)) 35%, transparent); }
    .chip:active { transform: scale(0.95); }
    .chip:focus-visible { outline: 2px solid var(--hcc-accent, var(--primary-color)); outline-offset: 2px; }
    .chip:disabled { opacity: 0.5; cursor: default; }
    .dropdown-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .dropdown-row .head { margin: 0 2px; flex: none; }
    .trigger {
      display: flex; align-items: center; gap: 4px; min-width: 0; max-width: 60%; border: none; border-radius: 999px;
      padding: 7px 10px 7px 14px; font: inherit; font-size: 13px; cursor: pointer;
      background: var(--hcc-accent, var(--primary-color)); color: var(--text-primary-color, #fff);
      transition: filter 0.2s, box-shadow 0.2s;
      box-shadow: 0 3px 10px color-mix(in srgb, var(--hcc-accent, var(--primary-color)) 35%, transparent);
    }
    .trigger span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .trigger:hover { filter: brightness(1.08); }
    .trigger:focus-visible { outline: 2px solid var(--hcc-accent, var(--primary-color)); outline-offset: 2px; }
    .trigger:disabled { opacity: 0.5; cursor: default; }
    .trigger ha-icon { --mdc-icon-size: 18px; flex: none; transition: transform 0.2s; }
    .trigger.open ha-icon { transform: rotate(180deg); }

    .menu {
      margin: 0; padding: 6px; border: none; border-radius: var(--hcc-inner-radius, 16px); box-sizing: border-box;
      background: var(--card-background-color, var(--ha-card-background, #fff)); color: var(--primary-text-color);
      box-shadow: 0 8px 28px rgba(0,0,0,0.22), 0 0 0 1px var(--divider-color, rgba(127,127,127,0.18));
      overflow-y: auto; overscroll-behavior: contain; scrollbar-width: thin;
      flex-direction: column; gap: 2px;
    }
    .menu[popover] { position: fixed; inset: auto; }
    .menu:popover-open { display: flex; opacity: 1; transform: none;
      transition: opacity 0.15s, transform 0.15s, display 0.15s allow-discrete, overlay 0.15s allow-discrete; }
    @starting-style { .menu:popover-open { opacity: 0; transform: translateY(-4px); } }
    .menu.up:popover-open { transform-origin: bottom; }
    .menu.inline { display: flex; margin-top: 8px; max-height: 280px; box-shadow: none;
      background: var(--hcc-chip-bg, rgba(127,127,127,0.08)); }
    .option {
      display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; flex: none;
      border: none; border-radius: 10px; padding: 9px 12px; background: transparent; color: inherit;
      font: inherit; font-size: 14px; text-align: left; cursor: pointer;
    }
    .option:hover, .option:focus-visible { background: rgba(127,127,127,0.12); outline: none; }
    .option.on { background: color-mix(in srgb, var(--hcc-accent, var(--primary-color)) 16%, transparent);
      color: var(--hcc-accent, var(--primary-color)); font-weight: 600; }
    .option ha-icon { --mdc-icon-size: 18px; flex: none; }
  `,t([mt()],ie.prototype,"label",void 0),t([mt()],ie.prototype,"icon",void 0),t([mt()],ie.prototype,"selected",void 0),t([mt({attribute:!1})],ie.prototype,"options",void 0),t([mt({type:Boolean})],ie.prototype,"disabled",void 0),t([mt({type:Number})],ie.prototype,"dropdownThreshold",void 0),t([ft()],ie.prototype,"_open",void 0),t([_t(".trigger")],ie.prototype,"_trigger",void 0),t([_t(".menu")],ie.prototype,"_menu",void 0),ie=t([dt("hcc-attribute-select")],ie);let se=class extends lt{constructor(){super(...arguments),this.items=[]}_open(t){t&&this.dispatchEvent(new CustomEvent("hass-more-info",{detail:{entityId:t},bubbles:!0,composed:!0}))}render(){return V`<div class="row">
      ${this.items.map(t=>V`
        <button class="item ${t.warning?"warn":""}" title=${t.label} @click=${()=>this._open(t.entity)}>
          <ha-icon .icon=${t.icon}></ha-icon>
          <div class="text"><span class="value">${t.value}</span><span class="label">${t.label}</span></div>
        </button>`)}
    </div>`}};se.styles=r`
    .row { display: grid; grid-template-columns: repeat(auto-fit, minmax(128px, 1fr)); gap: 8px; }
    .item {
      display: flex; align-items: center; gap: 8px; padding: 8px 10px; border: none; border-radius: var(--hcc-inner-radius, 12px);
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
  `,t([mt({attribute:!1})],se.prototype,"items",void 0),se=t([dt("hcc-sensor-row")],se);const ne=["unavailable","unknown"],oe=["auto","heat_cool"],re=(t,e=t.attributes.hvac_action)=>{if("off"===t.state||ne.includes(t.state))return Mt.off;if(oe.includes(t.state)){return Mt[zt[e??""]??t.state]??"var(--primary-color)"}return Mt[t.state]??"var(--primary-color)"},ae=(t,e=t.attributes.hvac_action)=>e&&Tt[e]&&((t,e)=>{const i=zt[e??""];return!i||i===t.state||oe.includes(t.state)})(t,e)?Tt[e]:Et[t.state]??"mdi:air-conditioner",ce=(t,e=t.attributes.hvac_action)=>"off"!==t.state&&!ne.includes(t.state)&&(!!e&&!["idle","off"].includes(e)),le=t=>{const e=null==t||""===t?NaN:Number(t);return Number.isFinite(e)?e:void 0},he=(t,e,i={})=>{if("off"===t)return"off";if(ne.includes(t))return;if("fan_only"===t)return"fan";const s=i.powerThreshold??25;if(null!=i.power&&i.power<s)return"idle";if("dry"===t)return"drying";const n=i.current??le(e.current_temperature),o=i.hysteresis??.3,r=le(e.temperature),a=le(e.target_temp_low),c=le(e.target_temp_high),l=null!=i.power;if("heat"===t)return null==n||null==r||n<r-o||l?"heating":"idle";if("cool"===t)return null==n||null==r||n>r+o||l?"cooling":"idle";if(null==n)return l?"fan":"idle";const h=a??r,d=c??r;return null!=h&&n<h-o?"heating":null!=d&&n>d+o?"cooling":l?"fan":"idle"},de=(t,e={})=>{const i=t.attributes.hvac_action;return i?{action:i,inferred:!1}:{action:he(t.state,t.attributes,e),inferred:!0}},pe=t=>{if(!t)return;const e=le(t.state);return null!=e?/^kW$/i.test(t.attributes.unit_of_measurement??"")?1e3*e:e:void 0},ue=t=>{const e=null==t||""===t?NaN:Number(t);return Number.isFinite(e)?e:void 0},me=t=>{if(!t||ne.includes(t.state))return;const e=t.entity_id.split(".")[0];return ue("climate"===e?t.attributes.current_temperature:"weather"===e?t.attributes.temperature:t.state)},fe=(t,e,i="°C")=>{if(e<=0||e>100)return;const s="°F"===i?5*(t-32)/9:t,n=243.12,o=Math.log(e/100)+17.62*s/(n+s),r=n*o/(17.62-o);return"°F"===i?9*r/5+32:r},_e={"clear-night":"mdi:weather-night",cloudy:"mdi:weather-cloudy",exceptional:"mdi:alert-circle-outline",fog:"mdi:weather-fog",hail:"mdi:weather-hail",lightning:"mdi:weather-lightning","lightning-rainy":"mdi:weather-lightning-rainy",partlycloudy:"mdi:weather-partly-cloudy",pouring:"mdi:weather-pouring",rainy:"mdi:weather-rainy",snowy:"mdi:weather-snowy","snowy-rainy":"mdi:weather-snowy-rainy",sunny:"mdi:weather-sunny",windy:"mdi:weather-windy","windy-variant":"mdi:weather-windy-variant"},ge=t=>{if(!t)return 0;const e=t.split(":").map(Number);for(;e.length<3;)e.unshift(0);return 3600*e[0]+60*e[1]+e[2]},be=t=>{const e=t=>String(Math.floor(t)).padStart(2,"0");return`${e(t/3600)}:${e(t%3600/60)}:${e(t%60)}`},ve=(t,e)=>{if(null==t||null==e)return;const i=t-e;if(Math.abs(i)<.25)return;return`color-mix(in srgb, ${i>0?"var(--state-climate-heat-color, #ff6d00)":"var(--state-climate-cool-color, #2196f3)"} ${Math.round(75*Math.min(1,Math.abs(i)/3))}%, var(--primary-text-color))`},ye=80;let we=class extends lt{constructor(){super(...arguments),this.hours=24,this.emptyText="",this.unit="",this._current=[],this._target=[],this._bands=[],this._loaded=!1,this._key=""}connectedCallback(){super.connectedCallback(),this._timer=window.setInterval(()=>this._fetch(),3e5)}disconnectedCallback(){super.disconnectedCallback(),clearInterval(this._timer)}updated(t){const e=`${this.entity}|${this.sensor}|${this.hours}`;this.hass&&e!==this._key&&(this._key=e,this._fetch()),super.updated(t)}async _fetch(){if(!this.hass||!this.entity)return;const t=new Date,e=new Date(t.getTime()-3600*this.hours*1e3),i=[this.entity,...this.sensor?[this.sensor]:[]];try{const s=await this.hass.callWS({type:"history/history_during_period",start_time:e.toISOString(),end_time:t.toISOString(),entity_ids:i,minimal_response:!1,no_attributes:!1,significant_changes_only:!1});this._parse(s,e.getTime(),t.getTime())}catch(t){console.warn("ha-climate-card: history fetch failed",t)}this._loaded=!0}_parse(t,e,i){const s=t[this.entity]??[],n=[],o=[],r=[];let a={};if(s.forEach((t,c)=>{t.a&&(a=t.a);const l=Math.max(1e3*t.lu,e),h=Number(a.current_temperature),d=Number(a.temperature??a.target_temp_high);!this.sensor&&Number.isFinite(h)&&n.push({t:l,v:h}),Number.isFinite(d)&&"off"!==t.s?o.push({t:l,v:d}):o.push({t:l,v:NaN});const p=a.hvac_action??he(t.s,a),u=zt[p??""];if(u&&"off"!==t.s){const t=s[c+1]?1e3*s[c+1].lu:i;r.push({from:l,to:t,color:Mt[u]})}}),this.sensor){const i=this.sensor.startsWith("climate.");let s={};for(const o of t[this.sensor]??[]){o.a&&(s=o.a);const t=Number(i?s.current_temperature:o.s);Number.isFinite(t)&&n.push({t:Math.max(1e3*o.lu,e),v:t})}}n.length&&n.push({t:i,v:n[n.length-1].v}),o.length&&o.push({t:i,v:o[o.length-1].v}),this._current=n,this._target=o,this._bands=r}_path(t,e,i,s){let n,o="";for(const r of t)Number.isFinite(r.v)?(o+=n?s?`H ${e(r.t).toFixed(1)} V ${i(r.v).toFixed(1)} `:`L ${e(r.t).toFixed(1)} ${i(r.v).toFixed(1)} `:`M ${e(r.t).toFixed(1)} ${i(r.v).toFixed(1)} `,n=r):n=void 0;return o}render(){if(!this._loaded)return V`<div class="placeholder"></div>`;const t=[...this._current,...this._target].map(t=>t.v).filter(Number.isFinite);if(!t.length)return V`<div class="placeholder empty">${this.emptyText}</div>`;const e=Date.now(),i=e-3600*this.hours*1e3;let s=Math.min(...t),n=Math.max(...t);const o=s,r=n;if(n-s<2){const t=(n+s)/2;s=t-1,n=t+1}const a=.15*(n-s);s-=a,n+=a;const c=t=>(t-i)/(e-i)*300,l=t=>ye-(t-s)/(n-s)*ye,h=this._current[this._current.length-1],d=this._current.filter(t=>Number.isFinite(t.v)),p=d.length>1?`${this._path(d,c,l,!1)} L ${c(d[d.length-1].t).toFixed(1)} 80 L ${c(d[0].t).toFixed(1)} 80 Z`:"";return V`
      <div class="graph">
        <svg viewBox="0 0 ${300} ${ye}" preserveAspectRatio="none">
          <defs>
            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" style="stop-color:var(--hcc-accent, var(--primary-color));stop-opacity:0.35"></stop>
              <stop offset="100%" style="stop-color:var(--hcc-accent, var(--primary-color));stop-opacity:0"></stop>
            </linearGradient>
          </defs>
          ${this._bands.map(t=>W`<rect x=${c(t.from)} y="0" width=${Math.max(.5,c(t.to)-c(t.from))}
            height=${ye} style="fill:${t.color}" class="band"></rect>`)}
          <path class="target" d=${this._path(this._target,c,l,!0)}></path>
          ${p?W`<path class="area" d=${p}></path>`:G}
          <path class="current" d=${this._path(this._current,c,l,!1)}></path>
        </svg>
        ${h&&Number.isFinite(h.v)?V`<span class="dot"
          style="left:${(c(h.t)/300*100).toFixed(2)}%;top:${(l(h.v)/ye*80).toFixed(1)}px"></span>`:G}
        <div class="labels">
          <span>-${this.hours}h</span>
          <span>${o.toFixed(1)}–${r.toFixed(1)}${this.unit}</span>
          ${h?V`<span>${h.v.toFixed(1)}${this.unit}</span>`:G}
        </div>
      </div>`}};we.styles=r`
    :host { display: block; }
    .graph { position: relative; animation: fade-in 0.6s ease both; }
    .graph svg { width: 100%; height: 80px; display: block; overflow: visible; }
    .area { fill: url(#areaGrad); stroke: none; }
    .dot { position: absolute; width: 8px; height: 8px; margin: -4px 0 0 -4px; border-radius: 50%;
      background: var(--hcc-accent, var(--primary-color)); box-shadow: 0 0 0 0 var(--hcc-accent, var(--primary-color));
      animation: dot-pulse 2.2s ease-out infinite; animation-play-state: var(--hcc-anim-state, running); }
    @keyframes dot-pulse { 0% { box-shadow: 0 0 0 0 color-mix(in srgb, var(--hcc-accent, var(--primary-color)) 60%, transparent); }
      100% { box-shadow: 0 0 0 10px transparent; } }
    @keyframes fade-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
    @media (prefers-reduced-motion: reduce) { .dot, .graph { animation: none; } }
    .band { opacity: 0.14; }
    .current { fill: none; stroke: var(--hcc-accent, var(--primary-color)); stroke-width: 2; vector-effect: non-scaling-stroke; stroke-linejoin: round; }
    .target { fill: none; stroke: var(--secondary-text-color); stroke-width: 1.5; stroke-dasharray: 4 3; vector-effect: non-scaling-stroke; opacity: 0.7; }
    .labels { display: flex; justify-content: space-between; font-size: 11px; color: var(--secondary-text-color); margin-top: 4px; }
    .placeholder { height: 80px; border-radius: var(--hcc-inner-radius, 12px); background: rgba(127,127,127,0.08); }
    .placeholder.empty { display: flex; align-items: center; justify-content: center; font-size: 12px; color: var(--secondary-text-color); }
  `,t([mt({attribute:!1})],we.prototype,"hass",void 0),t([mt()],we.prototype,"entity",void 0),t([mt()],we.prototype,"sensor",void 0),t([mt({type:Number})],we.prototype,"hours",void 0),t([mt()],we.prototype,"emptyText",void 0),t([mt()],we.prototype,"unit",void 0),t([ft()],we.prototype,"_current",void 0),t([ft()],we.prototype,"_target",void 0),t([ft()],we.prototype,"_bands",void 0),t([ft()],we.prototype,"_loaded",void 0),we=t([dt("hcc-history-graph")],we);const xe=t=>String(t).padStart(2,"0");let $e=class extends lt{constructor(){super(...arguments),this.label="Sleeptimer",this.offText="Off",this.atText="Off at",this.inText="in",this._now=Date.now()}connectedCallback(){super.connectedCallback(),this._tick=window.setInterval(()=>this._now=Date.now(),3e4)}disconnectedCallback(){super.disconnectedCallback(),clearInterval(this._tick)}get _switch(){return this.switchEntity?this.hass?.states[this.switchEntity]:void 0}get _time(){return this.timeEntity?this.hass?.states[this.timeEntity]:void 0}_nextOff(){const t=this._time;if(!t)return;const e=t.attributes;if(e.has_date&&e.timestamp)return new Date(1e3*e.timestamp);if(null==e.hour||null==e.minute)return;const i=new Date(this._now);return i.setHours(e.hour,e.minute,e.second??0,0),i.getTime()<=this._now&&i.setDate(i.getDate()+1),i}_timeValue(){const t=this._time?.attributes;return null!=t?.hour?`${xe(t.hour)}:${xe(t.minute??0)}`:""}_remaining(t){const e=Math.max(0,Math.round((t.getTime()-this._now)/6e4)),i=Math.floor(e/60);return i?`${i}:${xe(e%60)} h`:`${e} min`}_toggle(){const t=this._switch;t&&this.hass&&(window.dispatchEvent(new CustomEvent("haptic",{detail:"light"})),this.hass.callService("homeassistant","on"===t.state?"turn_off":"turn_on",{entity_id:t.entity_id}))}_setTime(t){const e=t.target.value,i=this._time;if(!e||!i||!this.hass)return;const s={entity_id:i.entity_id};if(i.attributes.has_date){const[t,i]=e.split(":").map(Number),n=new Date;n.setHours(t,i,0,0),n.getTime()<=Date.now()&&n.setDate(n.getDate()+1),s.datetime=`${n.getFullYear()}-${xe(n.getMonth()+1)}-${xe(n.getDate())} ${xe(t)}:${xe(i)}:00`}else s.time=`${e}:00`;this.hass.callService("input_datetime","set_datetime",s)}_moreInfo(t){t&&this.dispatchEvent(new CustomEvent("hass-more-info",{detail:{entityId:t},bubbles:!0,composed:!0}))}render(){if(!this.hass||!this._switch&&!this._time)return G;const t=!this._switch||"on"===this._switch.state,e=this._nextOff(),i=this._time?V`<input class="time" type="time" .value=${this._timeValue()} aria-label=${this.label} @change=${this._setTime} />`:G;return V`<div class="timer ${t?"armed":""}">
      <button class="badge" @click=${()=>this._moreInfo(this.switchEntity??this.timeEntity)} aria-label=${this.label}>
        <ha-icon icon=${t?"mdi:sleep":"mdi:sleep-off"}></ha-icon>
      </button>
      <div class="text">
        <span class="label">${this.label}</span>
        <span class="status">
          ${t?V`${this.atText} ${i}${e?V`<span class="remaining">· ${this.inText} ${this._remaining(e)}</span>`:G}`:V`${this.offText}${this._time?V` · ${i}`:G}`}
        </span>
      </div>
      ${this._switch?V`<button class="switch ${t?"on":""}" role="switch" aria-checked=${t}
        aria-label=${this.label} @click=${this._toggle}><span class="thumb"></span></button>`:G}
    </div>`}};$e.styles=r`
    .timer {
      display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: var(--hcc-inner-radius, 14px);
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
  `,t([mt({attribute:!1})],$e.prototype,"hass",void 0),t([mt()],$e.prototype,"switchEntity",void 0),t([mt()],$e.prototype,"timeEntity",void 0),t([mt()],$e.prototype,"label",void 0),t([mt()],$e.prototype,"offText",void 0),t([mt()],$e.prototype,"atText",void 0),t([mt()],$e.prototype,"inText",void 0),t([ft()],$e.prototype,"_now",void 0),$e=t([dt("hcc-sleep-timer")],$e);let ke=class extends lt{constructor(){super(...arguments),this.durations=[30,60,90,120],this.label="Off in",this.cancelText="Cancel",this._now=Date.now()}get _timer(){return this.entity?this.hass?.states[this.entity]:void 0}disconnectedCallback(){super.disconnectedCallback(),clearInterval(this._tick),this._tick=void 0}updated(){const t="active"===this._timer?.state;t&&!this._tick&&(this._tick=window.setInterval(()=>this._now=Date.now(),1e3)),!t&&this._tick&&(clearInterval(this._tick),this._tick=void 0)}_remaining(t){return"active"===t.state&&t.attributes.finishes_at?Math.max(0,(new Date(t.attributes.finishes_at).getTime()-this._now)/1e3):ge(t.attributes.remaining)}_start(t){this.hass&&this.entity&&(window.dispatchEvent(new CustomEvent("haptic",{detail:"light"})),this.hass.callService("timer","start",{entity_id:this.entity,duration:be(60*t)}))}_cancel(){this.hass&&this.entity&&(window.dispatchEvent(new CustomEvent("haptic",{detail:"light"})),this.hass.callService("timer","cancel",{entity_id:this.entity}))}_fmtChip(t){if(t<60)return`${t} min`;const e=t/60,i=this.hass?.locale?.language??this.hass?.language??"de";return`${e.toLocaleString(i,{maximumFractionDigits:1})} h`}_fmtRemaining(t){const e=Math.round(t),i=Math.floor(e/3600),s=Math.floor(e%3600/60),n=String(e%60).padStart(2,"0");return i?`${i}:${String(s).padStart(2,"0")}:${n}`:`${s}:${n}`}render(){const t=this._timer;if(!t)return G;const e="active"===t.state||"paused"===t.state,i=e?this._remaining(t):0,s=ge(t.attributes.duration)||1,n=e?Math.min(100,i/s*100):0;return V`<div class="countdown ${e?"running":""}">
      <div class="head">
        <span class="title"><ha-icon icon="mdi:timer-outline"></ha-icon>${e?V`<span class="remaining">${this._fmtRemaining(i)}</span>`:this.label}</span>
        ${e?V`
          <button class="cancel" @click=${this._cancel}>
            <ha-icon icon="mdi:timer-off-outline"></ha-icon><span>${this.cancelText}</span></button>`:G}
      </div>
      ${e?V`<div class="bar"><div style="width:${n}%"></div></div>`:G}
      <div class="chips">
        ${this.durations.map(t=>V`<button class="chip" @click=${()=>this._start(t)}>${this._fmtChip(t)}</button>`)}
      </div>
    </div>`}};ke.styles=r`
    .countdown { display: flex; flex-direction: column; gap: 8px; padding: 10px 12px; border-radius: var(--hcc-inner-radius, 14px);
      background: var(--hcc-chip-bg, rgba(127,127,127,0.12)); --c: var(--hcc-timer-color, #7e57c2); }
    .countdown.running { background: color-mix(in srgb, var(--c) 16%, transparent); }
    .head { display: flex; align-items: center; gap: 8px; min-height: 24px; }
    .title { display: flex; align-items: center; gap: 6px; flex: 1; min-width: 0; white-space: nowrap; font-size: 12px; font-weight: 500;
      color: var(--secondary-text-color); text-transform: uppercase; letter-spacing: 0.04em; }
    .title ha-icon { --mdc-icon-size: 16px; }
    .remaining { font-size: 18px; font-weight: 600; font-variant-numeric: tabular-nums; color: var(--primary-text-color); }
    .cancel { display: flex; align-items: center; gap: 4px; border: none; border-radius: 999px; padding: 5px 12px 5px 9px;
      font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; transition: background 0.2s;
      background: color-mix(in srgb, var(--error-color, #db4437) 16%, transparent); color: var(--error-color, #db4437); }
    .cancel:hover { background: color-mix(in srgb, var(--error-color, #db4437) 26%, transparent); }
    .cancel ha-icon { --mdc-icon-size: 16px; }
    .bar { height: 4px; border-radius: 2px; background: rgba(127,127,127,0.2); overflow: hidden; }
    .bar div { height: 100%; background: var(--c); transition: width 1s linear; }
    .chips { display: flex; gap: 6px; }
    .chip { flex: 1; border: none; border-radius: 999px; padding: 6px 4px; font: inherit; font-size: 13px; cursor: pointer;
      background: var(--card-background-color, #fff); color: var(--primary-text-color); transition: background 0.2s; }
    .chip:hover { background: color-mix(in srgb, var(--c) 20%, var(--card-background-color, #fff)); }
    .chip:focus-visible, .cancel:focus-visible { outline: 2px solid var(--c); outline-offset: 2px; }
  `,t([mt({attribute:!1})],ke.prototype,"hass",void 0),t([mt()],ke.prototype,"entity",void 0),t([mt({attribute:!1})],ke.prototype,"durations",void 0),t([mt()],ke.prototype,"label",void 0),t([mt()],ke.prototype,"cancelText",void 0),t([ft()],ke.prototype,"_now",void 0),ke=t([dt("hcc-countdown-timer")],ke);let Ae=class extends lt{constructor(){super(...arguments),this.speed=.5,this.swingVertical=!1,this.swingHorizontal=!1,this.color="var(--primary-color)",this.variant="neutral"}render(){const t=(2.8-2*this.speed).toFixed(2);return V`<svg viewBox="0 0 300 110" preserveAspectRatio="none"
      class="${this.swingVertical?"sv":""} ${this.swingHorizontal?"sh":""} ${this.variant}"
      style="--d:${t}s;--c:${this.color}">
      <g class="fan"><g class="shimmer">
        ${[-75,-50,-25,0,25,50,75].map((t,e)=>{const i=150+t,s=150+1.5*t;return W`<path d=${`M ${i} 0 C ${i+.15*t} 40, ${s-.1*t} 75, ${s} 110`} style="animation-delay:-${(.37*e).toFixed(2)}s"></path>`})}
      </g></g>
    </svg>`}};Ae.styles=r`
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
    /* Heizen: Warmluft flimmert und steigt auf */
    .heat path { stroke-opacity: 0.3; stroke-width: 2; stroke-dasharray: 3 12 8 17; animation-name: rise; }
    .heat .shimmer { transform-origin: 150px 0; transform-box: view-box; animation: shimmer 2.2s ease-in-out infinite; }
    .cool path { stroke-dasharray: 10 30; }
    @keyframes rise { from { stroke-dashoffset: 0; } to { stroke-dashoffset: 40; } }
    @keyframes shimmer { 0%, 100% { transform: skewX(0deg) scaleX(1); } 25% { transform: skewX(4deg) scaleX(1.03); }
      75% { transform: skewX(-4deg) scaleX(0.97); } }
    @keyframes flow { from { stroke-dashoffset: 40; } to { stroke-dashoffset: 0; } }
    @keyframes sv { 0%, 100% { scale: 1 0.75; } 50% { scale: 1 1.15; } }
    @keyframes sh { 0%, 100% { rotate: -8deg; } 50% { rotate: 8deg; } }
    path, .fan, .shimmer { animation-play-state: var(--hcc-anim-state, running) !important; }
    @media (prefers-reduced-motion: reduce) { path, .fan, .shimmer { animation: none !important; } }
  `,t([mt({type:Number})],Ae.prototype,"speed",void 0),t([mt({type:Boolean})],Ae.prototype,"swingVertical",void 0),t([mt({type:Boolean})],Ae.prototype,"swingHorizontal",void 0),t([mt()],Ae.prototype,"color",void 0),t([mt()],Ae.prototype,"variant",void 0),Ae=t([dt("hcc-airflow")],Ae);const Se=(t,e)=>({name:t,selector:{entity:{filter:e}}});let Ce=class extends lt{constructor(){super(...arguments),this._computeLabel=t=>t.name in Nt?this._t(`show_${t.name}`):this._t(t.name)}setConfig(t){this._config=t}_t(t){return Ft(this.hass,`editor.${t}`)}_schema(){return[{name:"entity",required:!0,selector:{entity:{domain:"climate"}}},{type:"grid",name:"",schema:[{name:"name",selector:{text:{}}},{name:"icon",selector:{icon:{}}}]},{name:"layout",selector:{select:{mode:"box",options:[{value:"full",label:this._t("layout_full")},{value:"compact",label:this._t("layout_compact")}]}}},{type:"expandable",name:"show",title:this._t("sections"),icon:"mdi:eye-outline",schema:[{type:"grid",name:"",schema:Object.keys(Nt).map(t=>({name:t,selector:{boolean:{}}}))}]},{type:"expandable",name:"",flatten:!0,title:this._t("sensors"),icon:"mdi:thermometer-lines",schema:[{name:"temperature_sensor",selector:{entity:{filter:[{domain:"sensor",device_class:"temperature"},{domain:"climate"}]}}},{name:"use_sensor_for_current",selector:{boolean:{}}},Se("humidity_sensor",{domain:"sensor",device_class:"humidity"}),Se("outdoor_sensor",{domain:["sensor","weather"]}),Se("power_sensor",{domain:"sensor",device_class:"power"}),{name:"power_threshold",selector:{number:{min:0,max:500,step:1,mode:"box",unit_of_measurement:"W"}}},Se("energy_sensor",{domain:"sensor",device_class:"energy"}),Se("window_sensor",{domain:"binary_sensor"})]},{type:"expandable",name:"",flatten:!0,title:this._t("hints_section"),icon:"mdi:weather-partly-cloudy",schema:[{name:"weather_entity",selector:{entity:{filter:{domain:"weather"}}}},{name:"ventilation_delta",selector:{number:{min:1,max:15,step:.5,mode:"box",unit_of_measurement:"°"}}},{name:"humidity_warning",selector:{number:{min:0,max:100,step:1,mode:"box",unit_of_measurement:"%"}}}]},{type:"expandable",name:"",flatten:!0,title:this._t("timer_section"),icon:"mdi:sleep",schema:[{name:"timer_switch",selector:{entity:{filter:{domain:["input_boolean","switch"]}}}},{name:"timer_time",selector:{entity:{filter:{domain:"input_datetime"}}}},{name:"countdown_timer",selector:{entity:{filter:{domain:"timer"}}}},{name:"countdown_durations",selector:{text:{}}}]},{type:"expandable",name:"",flatten:!0,title:this._t("shortcuts_section"),icon:"mdi:gesture-tap-button",schema:[{name:"auto_shortcuts",selector:{boolean:{}}},{name:"shortcuts",selector:{entity:{multiple:!0,filter:{domain:["switch","input_boolean","light","fan","script","scene","button","input_button","automation"]}}}}]},{type:"expandable",name:"",flatten:!0,title:this._t("appearance"),icon:"mdi:palette-outline",schema:[{name:"animations",selector:{select:{mode:"dropdown",options:["full","reduced","off"].map(t=>({value:t,label:this._t(`anim_${t}`)}))}}},{name:"expandable",selector:{boolean:{}}},{name:"start_expanded",selector:{boolean:{}}},{name:"dropdown_threshold",selector:{number:{min:0,max:20,step:1,mode:"box"}}},{name:"graph_hours",selector:{number:{min:1,max:168,step:1,mode:"box",unit_of_measurement:"h"}}}]}]}_valueChanged(t){const e={...t.detail.value};if("string"==typeof e.countdown_durations){const t=e.countdown_durations.split(/[,; ]+/).map(Number).filter(t=>t>0);e.countdown_durations=t.length?t:void 0}const i=e;if(Array.isArray(i.shortcuts)){const t=this._config?.shortcuts??[];i.shortcuts=i.shortcuts.map(e=>{const i="string"==typeof e?e:e.entity;return t.find(t=>"string"!=typeof t&&t.entity===i)??i})}for(const t of Object.keys(i)){const e=i[t];(""===e||null==e||Array.isArray(e)&&!e.length)&&delete i[t]}this._config=i,this.dispatchEvent(new CustomEvent("config-changed",{detail:{config:i},bubbles:!0,composed:!0}))}render(){if(!this.hass||!this._config)return G;const t={layout:"full",graph_hours:24,auto_shortcuts:!0,use_sensor_for_current:!0,expandable:!0,dropdown_threshold:6,animations:"full",power_threshold:25,ventilation_delta:3,humidity_warning:70,...this._config,shortcuts:this._config.shortcuts?.map(t=>"string"==typeof t?t:t.entity),countdown_durations:this._config.countdown_durations?.join(", "),show:{...Nt,...this._config.show??{}}};return V`<ha-form .hass=${this.hass} .data=${t} .schema=${this._schema()}
      .computeLabel=${this._computeLabel} @value-changed=${this._valueChanged}></ha-form>`}};Ce.styles=r`:host { display: block; }`,t([mt({attribute:!1})],Ce.prototype,"hass",void 0),t([ft()],Ce.prototype,"_config",void 0),Ce=t([dt("ha-climate-card-editor")],Ce),window.customCards=window.customCards||[],window.customCards.push({type:"ha-climate-overview-card",name:"HA Climate Overview",description:"Alle Klimaanlagen auf einen Blick – mit Temperatur, Schnellregelung und „Alle aus“.",preview:!0,documentationURL:"https://github.com/passi277/HA_Climate_Card"});let Ee=class extends lt{constructor(){super(...arguments),this._pending={},this._timers={},this._holdEnd=()=>{clearTimeout(this._holdDelay),clearInterval(this._holdRepeat)}}disconnectedCallback(){super.disconnectedCallback(),this._holdEnd()}_haptic(t="light"){window.dispatchEvent(new CustomEvent("haptic",{detail:t}))}_callService(t,e){this.hass.callService("climate",t,e).catch(t=>{this._haptic("failure"),this.dispatchEvent(new CustomEvent("hass-notification",{detail:{message:`${Ft(this.hass,"card.error")}: ${t?.message??t}`},bubbles:!0,composed:!0}))})}_holdStart(t,e){0===t.button&&(this._holdEnd(),e(),this._holdDelay=window.setTimeout(()=>this._holdRepeat=window.setInterval(e,110),420))}_holdButton(t,e,i){return V`<button aria-label=${t}
      @pointerdown=${t=>this._holdStart(t,i)} @pointerup=${this._holdEnd}
      @pointerleave=${this._holdEnd} @pointercancel=${this._holdEnd} @contextmenu=${t=>t.preventDefault()}
      @click=${t=>{0===t.detail&&i()}}><ha-icon icon=${e}></ha-icon></button>`}static getConfigElement(){return document.createElement("ha-climate-overview-card-editor")}static getStubConfig(t){return{entities:Object.keys(t.states).filter(t=>t.startsWith("climate.")).slice(0,3)}}setConfig(t){if(!Array.isArray(t?.entities)||!t.entities.length)throw new Error("ha-climate-overview-card: 'entities' (Liste von climate-Entitäten) fehlt");this._config={show_all_off:!0,show_controls:!0,...t}}getCardSize(){return 1+(this._config?.entities.length??1)}getGridOptions(){return{columns:12,min_columns:6,rows:"auto"}}get _entities(){return(this._config?.entities??[]).map(t=>"string"==typeof t?{entity:t}:t)}shouldUpdate(t){if(!t.has("hass")||t.size>1)return!0;const e=t.get("hass");return!e||this._entities.some(t=>e.states[t.entity]!==this.hass.states[t.entity])}updated(t){if(super.updated(t),!t.has("hass"))return;const e=t.get("hass");for(const t of Object.keys(this._pending))if(e&&e.states[t]!==this.hass.states[t]){const{[t]:e,...i}=this._pending;this._pending=i}}_t(t){return Ft(this.hass,t)}_unit(){return this.hass?.config?.unit_system?.temperature??"°C"}_step(t){return Number(t.attributes.target_temp_step)||("°F"===this._unit()?1:.5)}_fmt(t,e){return null==t?"–":t.toFixed(e<1?1:0)}_stepTarget(t,e){const i=this._step(t),s=t.attributes,n=this._pending[t.entity_id]??Number(s.temperature);if(!Number.isFinite(n))return;const o=Math.min(Number(s.max_temp??35),Math.max(Number(s.min_temp??7),n+e*i)),r=Number(o.toFixed(i<1?1:0));r!==n&&this._haptic("selection"),this._pending={...this._pending,[t.entity_id]:r},clearTimeout(this._timers[t.entity_id]),this._timers[t.entity_id]=window.setTimeout(()=>{this._callService("set_temperature",{entity_id:t.entity_id,temperature:this._pending[t.entity_id]})},1e3)}_togglePower(t){this._haptic();const e=t.attributes;if("off"===t.state)if(St(e,kt))this._callService("turn_on",{entity_id:t.entity_id});else{const i=e.hvac_modes?.find(t=>"off"!==t);i&&this._callService("set_hvac_mode",{entity_id:t.entity_id,hvac_mode:i})}else St(e,$t)?this._callService("turn_off",{entity_id:t.entity_id}):this._callService("set_hvac_mode",{entity_id:t.entity_id,hvac_mode:"off"})}_allOff(t){this._haptic("success");for(const e of t){const t=this.hass.states[e];St(t.attributes,$t)?this._callService("turn_off",{entity_id:e}):this._callService("set_hvac_mode",{entity_id:e,hvac_mode:"off"})}}_moreInfo(t){this.dispatchEvent(new CustomEvent("hass-more-info",{detail:{entityId:t},bubbles:!0,composed:!0}))}_renderRow(t){const e=this.hass.states[t.entity];if(!e)return V`<div class="row missing">${this._t("card.entity_not_found")}: ${t.entity}</div>`;const i=e.attributes,s=de(e).action,n=re(e,s),o="off"===e.state,r=ne.includes(e.state),a=this._step(e),c=me(e),l=this._pending[e.entity_id]??(null!=i.temperature?Number(i.temperature):void 0),h=null!=i.target_temp_low&&null!=i.target_temp_high&&null==i.temperature,d=r?this._t("card.unavailable"):s?Ut(this.hass,e,"hvac_action",s):Rt(this.hass,e,e.state),p=t.name??i.friendly_name??e.entity_id,u=ce(e,s);return V`<div class="row ${o?"off":""} ${u?"active":""}" style="--hcc-accent-c:${n}">
      <button class="info" @click=${()=>this._moreInfo(e.entity_id)}>
        <span class="badge ${u?"active":""}" data-action=${s??""}>
          <ha-icon .icon=${ae(e,s)}></ha-icon>
        </span>
        <span class="names">
          <span class="name">${p}</span>
          <span class="status">${d}${null!=c?V` · <ha-icon icon="mdi:home-thermometer-outline"></ha-icon><span
            style=${`color:${o?"inherit":ve(c,l)??"inherit"}`}>${this._fmt(c,a)}°</span>`:G}</span>
        </span>
      </button>
      ${!this._config.show_controls||o||r?G:h?V`<span class="target">${this._fmt(Number(i.target_temp_low),a)}–${this._fmt(Number(i.target_temp_high),a)}°</span>`:null!=l?V`<div class="stepper">
              ${this._holdButton("-","mdi:minus",()=>this._stepTarget(e,-1))}
              <span class="target">${this._fmt(l,a)}°</span>
              ${this._holdButton("+","mdi:plus",()=>this._stepTarget(e,1))}
            </div>`:G}
      <button class="power ${o?"":"on"}" ?disabled=${r} @click=${()=>this._togglePower(e)}
        aria-label=${this._t(o?"card.turn_on":"card.turn_off")} title=${this._t(o?"card.turn_on":"card.turn_off")}>
        <ha-icon icon="mdi:power"></ha-icon>
      </button>
    </div>`}render(){if(!this._config||!this.hass)return G;const t=this._entities.map(t=>t.entity).filter(t=>this.hass.states[t]),e=t.filter(t=>!["off",...ne].includes(this.hass.states[t].state));return V`<ha-card>
      <div class="header">
        <div class="titles">
          <span class="title">${this._config.title??this._t("overview.title")}</span>
          <span class="sub">${e.length} ${this._t("overview.of")} ${t.length} ${this._t("overview.running")}</span>
        </div>
        ${this._config.show_all_off?V`<button class="all-off" ?disabled=${!e.length} @click=${()=>this._allOff(e)}>
          <ha-icon icon="mdi:power"></ha-icon>${this._t("overview.all_off")}</button>`:G}
      </div>
      <div class="rows">${this._entities.map(t=>this._renderRow(t))}</div>
    </ha-card>`}};Ee.styles=r`
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
    .row { --accent: var(--hcc-accent-c, var(--primary-color)); position: relative; overflow: hidden; isolation: isolate;
      display: flex; align-items: center; gap: 8px; padding: 8px; border-radius: calc(var(--ha-card-border-radius, 16px) * 0.85);
      background: color-mix(in srgb, var(--accent) 10%, rgba(127,127,127,0.06));
      transition: --hcc-accent-c 0.7s ease, background 0.3s; animation: row-in 0.45s cubic-bezier(0.22, 1, 0.36, 1) both; }
    .row::before { content: ""; position: absolute; inset: -40% auto -40% -10%; width: 45%; z-index: -1; pointer-events: none;
      background: radial-gradient(closest-side, color-mix(in srgb, var(--accent) 35%, transparent), transparent); opacity: 0; transition: opacity 0.6s; }
    .row.active::before { opacity: 1; animation: row-glow 4s ease-in-out infinite; }
    .rows .row:nth-child(2) { animation-delay: 0.05s; } .rows .row:nth-child(3) { animation-delay: 0.1s; }
    .rows .row:nth-child(4) { animation-delay: 0.15s; } .rows .row:nth-child(n+5) { animation-delay: 0.2s; }
    @keyframes row-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
    @keyframes row-glow { 0%, 100% { transform: translateX(0) scale(1); } 50% { transform: translateX(8%) scale(1.1); } }
    .row.off { background: rgba(127,127,127,0.08); }
    .row.missing { color: var(--error-color, #db4437); font-size: 13px; }
    .info { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; background: none; border: none; padding: 0;
      cursor: pointer; text-align: left; }
    .badge { flex: none; width: 38px; height: 38px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
      background: color-mix(in srgb, var(--accent) 22%, transparent); color: var(--accent); }
    .badge.active ha-icon { animation: breathe 2.4s ease-in-out infinite; }
    .badge.active[data-action="cooling"] ha-icon { animation: spin 9s linear infinite; }
    .badge.active[data-action="fan"] ha-icon { animation: spin 1.6s linear infinite; }
    .badge.active[data-action="heating"] ha-icon, .badge.active[data-action="preheating"] ha-icon {
      animation: flicker 1.8s ease-in-out infinite; transform-origin: 50% 85%; }
    .badge.active[data-action="drying"] ha-icon { animation: bob 2s ease-in-out infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes flicker { 0%, 100% { transform: scale(1) rotate(0); } 25% { transform: scale(1.08, 0.95) rotate(-3deg); }
      50% { transform: scale(0.96, 1.07) rotate(2deg); } 75% { transform: scale(1.05, 0.97) rotate(-1deg); } }
    @keyframes bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }
    .names { display: flex; flex-direction: column; min-width: 0; }
    .name { font-size: 14px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .status { display: flex; align-items: center; gap: 2px; font-size: 12px; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; }
    .status span { flex: none; }
    .status ha-icon { --mdc-icon-size: 14px; }
    .stepper { display: flex; align-items: center; gap: 2px; background: var(--card-background-color, #fff); border-radius: 999px; padding: 2px; }
    .stepper button { width: 30px; height: 30px; border: none; border-radius: 50%; background: transparent; cursor: pointer;
      color: var(--accent); display: flex; align-items: center; justify-content: center; padding: 0; }
    .stepper button:hover { background: color-mix(in srgb, var(--accent) 18%, transparent); }
    .stepper ha-icon { --mdc-icon-size: 18px; }
    .target { min-width: 40px; text-align: center; font-size: 16px; font-weight: 600; font-variant-numeric: tabular-nums; }
    .power { flex: none; width: 38px; height: 38px; border-radius: 50%; border: none; cursor: pointer; padding: 0;
      background: rgba(127,127,127,0.14); color: var(--secondary-text-color); display: flex; align-items: center; justify-content: center; }
    .power { transition: background 0.3s, box-shadow 0.4s, transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1); }
    .power:active { transform: scale(0.9); }
    .power.on { background: var(--accent); color: var(--text-primary-color, #fff);
      box-shadow: 0 4px 12px color-mix(in srgb, var(--accent) 45%, transparent); }
    .stepper button { touch-action: manipulation; user-select: none; -webkit-user-select: none; transition: background 0.2s, transform 0.2s; }
    .stepper button:active { transform: scale(0.86); }
    .power:disabled { opacity: 0.4; cursor: default; }
    .power ha-icon { --mdc-icon-size: 20px; }
    @keyframes breathe { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.12); } }
    @media (prefers-reduced-motion: reduce) { .badge.active ha-icon, .row, .row.active::before { animation: none; } }
  `,t([mt({attribute:!1})],Ee.prototype,"hass",void 0),t([ft()],Ee.prototype,"_config",void 0),t([ft()],Ee.prototype,"_pending",void 0),Ee=t([dt("ha-climate-overview-card")],Ee);let Te=class extends lt{constructor(){super(...arguments),this._schema=[{name:"title",selector:{text:{}}},{name:"entities",required:!0,selector:{entity:{multiple:!0,filter:{domain:"climate"}}}},{type:"grid",name:"",schema:[{name:"show_all_off",selector:{boolean:{}}},{name:"show_controls",selector:{boolean:{}}}]}],this._computeLabel=t=>Ft(this.hass,`overview.editor_${t.name}`)}setConfig(t){this._config=t}_valueChanged(t){const e={...t.detail.value},i=this._config?.entities??[];e.entities=(e.entities??[]).map(t=>i.find(e=>"string"!=typeof e&&e.entity===t)??t),e.title||delete e.title,this._config=e,this.dispatchEvent(new CustomEvent("config-changed",{detail:{config:e},bubbles:!0,composed:!0}))}render(){if(!this.hass||!this._config)return G;const t={show_all_off:!0,show_controls:!0,...this._config,entities:(this._config.entities??[]).map(t=>"string"==typeof t?t:t.entity)};return V`<ha-form .hass=${this.hass} .data=${t} .schema=${this._schema}
      .computeLabel=${this._computeLabel} @value-changed=${this._valueChanged}></ha-form>`}};t([mt({attribute:!1})],Te.prototype,"hass",void 0),t([ft()],Te.prototype,"_config",void 0),Te=t([dt("ha-climate-overview-card-editor")],Te);const Me="var(--accent)",ze=["unavailable","unknown"];console.info("%c HA-CLIMATE-CARD %c v1.0.0 ","color:#fff;background:#2196f3;font-weight:700;border-radius:4px 0 0 4px","color:#2196f3;background:#fff;font-weight:700;border-radius:0 4px 4px 0");try{window.CSS?.registerProperty?.({name:"--hcc-accent-c",syntax:"<color>",inherits:!0,initialValue:"transparent"})}catch{}window.customCards=window.customCards||[],window.customCards.push({type:"ha-climate-card",name:"HA Climate Card",description:"Moderne Karte für Klimaanlagen mit Drehregler, allen Modi, Sensoren und Verlauf.",preview:!0,documentationURL:"https://github.com/passi277/HA_Climate_Card"});let Ne=class extends lt{constructor(){super(...arguments),this._expanded=!1,this._syncing=!1,this._graphLoaded=!1,this._samples=[],this._popValues=new Map,this._holdEnd=()=>{clearTimeout(this._holdDelay),clearInterval(this._holdRepeat)}}static getConfigElement(){return document.createElement("ha-climate-card-editor")}static getStubConfig(t){return{entity:Object.keys(t.states).find(t=>t.startsWith("climate."))??"",layout:"full"}}setConfig(t){if(!t?.entity||!t.entity.startsWith("climate."))throw new Error("ha-climate-card: 'entity' muss eine climate-Entität sein (climate.xyz)");const e=this._config?.start_expanded!==t.start_expanded;this._config={layout:"full",graph_hours:24,...t},e&&(this._expanded=!!t.start_expanded)}getCardSize(){return"compact"===this._config?.layout?this._expanded?6:2:!1===this._config?.expandable||this._expanded?this._show.graph?10:8:6}getGridOptions(){return{columns:6,min_columns:4,rows:"auto"}}get _show(){return{...Nt,...this._config?.show??{}}}get _stateObj(){return this._config&&this.hass?.states[this._config.entity]}shouldUpdate(t){if(!t.has("hass")||t.size>1)return!0;const e=t.get("hass");if(!e||!this._config)return!0;return[this._config.entity,this._config.temperature_sensor,this._config.humidity_sensor,this._config.outdoor_sensor,this._config.power_sensor,this._config.energy_sensor,this._config.window_sensor,this._config.timer_switch,this._config.timer_time,this._config.countdown_timer,this._config.weather_entity,...this._shortcutIds()].filter(Boolean).some(t=>e.states[t]!==this.hass.states[t])||e.locale!==this.hass.locale}willUpdate(){const t=this._config;!this._graphLoaded&&t&&(this._expanded||"compact"!==t.layout&&!1===t.expandable)&&(this._graphLoaded=!0)}updated(t){super.updated(t),(t.has("hass")||t.has("_config"))&&(this._subscribeWeather(),this._maybeFetchToday(),this._recordSample()),this._popChangedValues();const e=this._stateObj;e&&this._sentAt&&e.last_updated!==this._sentAt&&(this._sentAt=void 0,this._pending=void 0,this._pendingHumidity=void 0,this._syncing=!1)}connectedCallback(){super.connectedCallback(),this.hass&&this._subscribeWeather()}_popChangedValues(){const t=window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;this.shadowRoot?.querySelectorAll("[data-pop]").forEach(e=>{const i=e.dataset.pop,s=e.textContent,n=this._popValues.get(i);t||void 0===n||n===s||e.animate([{transform:"translateY(4px) scale(0.94)",opacity:.4},{transform:"none",opacity:1}],{duration:380,easing:"cubic-bezier(0.34, 1.56, 0.64, 1)"}),this._popValues.set(i,s)})}disconnectedCallback(){super.disconnectedCallback(),this._holdEnd(),clearTimeout(this._errorTimer),clearInterval(this._todayTimer),this._todayTimer=void 0,this._todayKey=void 0,this._unsubscribeWeather(),clearTimeout(this._tempTimer),clearTimeout(this._humTimer),clearTimeout(this._clearTimer)}_t(t){return Ft(this.hass,t)}get _unit(){return this.hass?.config?.unit_system?.temperature??"°C"}_step(t){return Number(t.attributes.target_temp_step)||("°F"===this._unit?1:.5)}_fmt(t,e=.5){return null!=t&&Number.isFinite(Number(t))?Number(t).toFixed(e<1?1:0):"–"}_isDual(t){const e=t.attributes;return St(e,bt)&&null!=e.target_temp_low&&null!=e.target_temp_high&&(null==e.temperature||!St(e,gt))}_modeColor(t){return re(t,this._action(t))}_isActive(t){return ce(t,this._action(t))}_action(t){const e=this._config;return de(t,{current:this._currentTemp(t),power:e?.power_sensor?pe(this.hass?.states[e.power_sensor]):void 0,powerThreshold:e?.power_threshold}).action}_unsubscribeWeather(){this._weatherUnsub?.then(t=>t()).catch(()=>{}),this._weatherUnsub=void 0,this._weatherKey=void 0}_subscribeWeather(){const t=this._config?.weather_entity;if(!t||!this.hass||!this.isConnected)return void(this._weatherKey&&this._unsubscribeWeather());if(this._weatherKey===t)return;this._unsubscribeWeather(),this._weatherKey=t;const e=this.hass.states[t]?.attributes.forecast;e?.length&&(this._forecast=e[0]),this.hass.connection&&(this._weatherUnsub=this.hass.connection.subscribeMessage(t=>{t.forecast?.length&&(this._forecast=t.forecast[0])},{type:"weather/subscribe_forecast",forecast_type:"daily",entity_id:t}),this._weatherUnsub.catch(()=>{this._weatherUnsub=this.hass?.connection?.subscribeMessage(t=>{if(!t.forecast?.length)return;const e=t.forecast.slice(0,24).map(t=>t.temperature).filter(t=>null!=t);this._forecast={condition:t.forecast[0].condition,temperature:Math.max(...e),templow:Math.min(...e)}},{type:"weather/subscribe_forecast",forecast_type:"hourly",entity_id:t}),this._weatherUnsub?.catch(()=>{})}))}_maybeFetchToday(){const t=this._config;if(!t||!this.hass||!this.isConnected)return;const e=`${t.entity}|${this._externalTemp?.entity_id??""}`;e!==this._todayKey&&(this._todayKey=e,clearInterval(this._todayTimer),this._fetchToday(),this._todayTimer=window.setInterval(()=>this._fetchToday(),6e5))}async _fetchToday(){const t=this._config,e=this.hass;if(!t||!e)return;const i=Date.now(),s=new Date;s.setHours(0,0,0,0);const n=Math.min(s.getTime(),i-27e5),o=this._externalTemp?.entity_id;try{const r=await e.callWS({type:"history/history_during_period",start_time:new Date(n).toISOString(),end_time:new Date(i).toISOString(),entity_ids:[t.entity,...o?[o]:[]],minimal_response:!1,no_attributes:!1,significant_changes_only:!1});let a=0,c={};const l=r[t.entity]??[];l.forEach((t,e)=>{t.a&&(c=t.a);const n=Math.max(1e3*t.lu,s.getTime()),o=l[e+1]?1e3*l[e+1].lu:i;if(o<=n)return;const r=c.hvac_action??he(t.s,c);r&&!["idle","off"].includes(r)&&(a+=o-n)}),this._runtimeToday=a/1e3;const h=[];let d={};for(const e of r[o??t.entity]??[]){e.a&&(d=e.a);const t=Number(o&&!o.startsWith("climate.")?e.s:d.current_temperature);Number.isFinite(t)&&h.push({t:Math.max(1e3*e.lu,i-27e5),v:t})}this._samples=h}catch(t){console.warn("ha-climate-card: history (today) failed",t)}}_recordSample(){const t=this._stateObj,e=t?this._currentTemp(t):void 0;if(null==e)return;const i=Date.now(),s=this._samples[this._samples.length-1];s&&s.v===e||(this._samples=[...this._samples.filter(t=>t.t>=i-27e5),{t:i,v:e}])}_goal(t){if("off"===t.state)return;const e=this._targets(t);if(!this._isDual(t))return e.value;const i=this._currentTemp(t);return null!=i&&null!=e.low&&null!=e.high?i<e.low?e.low:i>e.high?e.high:void 0:void 0}_etaText(t){const e=this._goal(t),i=this._currentTemp(t);if(null==e||null==i||!this._isActive(t))return;const s=Date.now(),n=this._samples.filter(t=>t.t>=s-18e5),o=((t,e,i)=>{if(null==i||Math.abs(i)<.008)return;const s=(e-t)/i;return!Number.isFinite(s)||s<=0||s>240?void 0:s})(i,e,(t=>{if(t.length<2)return;const e=t[0].t,i=t.map(t=>(t.t-e)/6e4);if(i[i.length-1]-i[0]<8)return;const s=i.length,n=i.reduce((t,e)=>t+e,0)/s,o=t.reduce((t,e)=>t+e.v,0)/s;let r=0,a=0;return i.forEach((e,i)=>{r+=(e-n)*(t[i].v-o),a+=(e-n)**2}),a?r/a:void 0})(n));if(null==o)return;const r=o<15?Math.max(1,Math.round(o)):5*Math.round(o/5),a=r>=60?`${Math.floor(r/60)} h ${String(r%60).padStart(2,"0")} min`:`${r} min`;return`${this._t("card.eta")} ${a}`}_fmtDuration(t){const e=this.hass?.locale?.language??this.hass?.language??"de";return t<3600?`${Math.round(t/60)} min`:`${(t/3600).toLocaleString(e,{maximumFractionDigits:1})} h`}_renderPills(t){const e=this._config,i=this.hass,s=[],n=t.attributes.preset_mode;if(n&&!["none","off"].includes(n)&&s.push({icon:"mdi:star-four-points-outline",text:Ut(i,t,"preset_mode",n)}),e.timer_switch&&"on"===i.states[e.timer_switch]?.state){const t=e.timer_time?i.states[e.timer_time]?.attributes:void 0,n=null!=t?.hour?`${String(t.hour).padStart(2,"0")}:${String(t.minute??0).padStart(2,"0")}`:"";s.push({icon:"mdi:sleep",text:n||this._t("card.sleep_timer")})}const o=e.countdown_timer?i.states[e.countdown_timer]:void 0;if("active"===o?.state&&o.attributes.finishes_at){const t=new Date(o.attributes.finishes_at);s.push({icon:"mdi:timer-outline",text:`${this._t("card.until")} ${String(t.getHours()).padStart(2,"0")}:${String(t.getMinutes()).padStart(2,"0")}`})}if(this._show.shortcuts)for(const e of this._shortcutItems(t)){const t=i.states[e.entity];"on"===t?.state&&["switch","input_boolean","light","fan"].includes(e.entity.split(".")[0])&&s.push({icon:e.icon??Kt(t,e.entity,e.name),text:e.name})}return s.length?V`<div class="pills">${s.slice(0,5).map(t=>V`<span class="pill"><ha-icon .icon=${t.icon}></ha-icon>${t.text}</span>`)}</div>`:G}_outdoorTemp(){const t=this._config;return(t.outdoor_sensor?me(this.hass.states[t.outdoor_sensor]):void 0)??(t.weather_entity?me(this.hass.states[t.weather_entity]):void 0)}get _externalTemp(){const t=this._config;if(t?.temperature_sensor&&!1!==t.use_sensor_for_current)return this.hass?.states[t.temperature_sensor]}_tempOf(t){if(!t)return;const e=t.entity_id.startsWith("climate.")?t.attributes.current_temperature:t.state,i=null==e||""===e?NaN:Number(e);return Number.isFinite(i)?i:void 0}_currentTemp(t){return this._tempOf(this._externalTemp)??this._tempOf(t)}_currentHumidity(t){const e=this._config,i=[e?.humidity_sensor?this.hass?.states[e.humidity_sensor]?.state:void 0,this._externalTemp?.attributes.current_humidity,t.attributes.current_humidity];for(const t of i){const e=null==t||""===t?NaN:Number(t);if(Number.isFinite(e))return e}}_targets(t){const e=t.attributes;return{value:this._pending?.value??(null!=e.temperature?Number(e.temperature):void 0),low:this._pending?.low??(null!=e.target_temp_low?Number(e.target_temp_low):void 0),high:this._pending?.high??(null!=e.target_temp_high?Number(e.target_temp_high):void 0)}}_sensorState(t){if(!t||!this.hass)return;const e=this.hass.states[t];if(!e)return;if(ze.includes(e.state))return"–";if(t.startsWith("weather.")||t.startsWith("climate.")){const t=me(e);return null!=t?`${t} ${e.attributes.temperature_unit??this._unit}`:"–"}if(this.hass.formatEntityState)return this.hass.formatEntityState(e);const i=e.attributes.unit_of_measurement;return i?`${e.state} ${i}`:e.state}_windowOpen(){const t=this._config?.window_sensor;return!!t&&"on"===this.hass?.states[t]?.state}_autoShortcutIds(){const t=this.hass,e=this._config?.entity;if(!t?.entities||!e)return[];const i=this._autoShortcutCache;if(i&&i.key===t.entities&&i.device===e)return i.ids;const s=t.entities[e]?.device_id,n=s?Object.values(t.entities).filter(t=>t.device_id===s&&t.entity_id!==e&&!t.hidden&&Ot.includes(t.entity_id.split(".")[0])).map(t=>t.entity_id).sort():[];return this._autoShortcutCache={key:t.entities,device:e,ids:n},n}_shortcutIds(){const t=this._config;return t?t.shortcuts?t.shortcuts.map(t=>"string"==typeof t?t:t.entity):!1===t.auto_shortcuts?[]:this._autoShortcutIds():[]}_shortName(t,e){const i=this.hass.states[t]?.attributes.friendly_name??t.split(".")[1],s=this.hass.entities?.[t]?.device_id,n=s?this.hass.devices?.[s]:void 0,o=[n?.name_by_user,n?.name,e.attributes.friendly_name,this._config?.name].filter(t=>!!t).sort((t,e)=>e.length-t.length);for(const t of o)if(i.toLowerCase().startsWith(t.toLowerCase()+" "))return i.slice(t.length+1);return i}_shortcutItems(t){const e=this._config;return(e.shortcuts??(!1===e.auto_shortcuts?[]:this._autoShortcutIds())).map(t=>"string"==typeof t?{entity:t}:t).filter(t=>t?.entity&&this.hass.states[t.entity]).map(e=>({entity:e.entity,name:e.name??this._shortName(e.entity,t),icon:e.icon}))}_call(t,e={}){const i=this._stateObj;i&&this.hass&&(this._sentAt=i.last_updated,this._syncing=!0,this.hass.callService("climate",t,{entity_id:i.entity_id,...e}).catch(t=>{console.error("ha-climate-card:",t),this._pending=void 0,this._pendingHumidity=void 0,this._syncing=!1,this._showError(t?.message??String(t))}),clearTimeout(this._clearTimer),this._clearTimer=window.setTimeout(()=>{this._pending=void 0,this._pendingHumidity=void 0,this._sentAt=void 0,this._syncing=!1},6e3))}_showError(t){this._error=`${this._t("card.error")}: ${t}`,this.dispatchEvent(new CustomEvent("hass-notification",{detail:{message:this._error},bubbles:!0,composed:!0})),this._haptic("failure"),clearTimeout(this._errorTimer),this._errorTimer=window.setTimeout(()=>this._error=void 0,6e3)}_haptic(t="light"){window.dispatchEvent(new CustomEvent("haptic",{detail:t}))}_holdStart(t,e){0===t.button&&(this._holdEnd(),e(),this._holdDelay=window.setTimeout(()=>{this._holdRepeat=window.setInterval(e,110)},420))}_holdButton(t,e,i,s=""){return V`<button class=${s} aria-label=${t}
      @pointerdown=${t=>this._holdStart(t,i)} @pointerup=${this._holdEnd}
      @pointerleave=${this._holdEnd} @pointercancel=${this._holdEnd}
      @contextmenu=${t=>t.preventDefault()}
      @click=${t=>{0===t.detail&&i()}}><ha-icon icon=${e}></ha-icon></button>`}_scheduleTemp(t){clearTimeout(this._tempTimer),this._tempTimer=window.setTimeout(()=>{const t=this._stateObj,e=this._pending;t&&e&&(this._isDual(t)?this._call("set_temperature",{target_temp_low:e.low,target_temp_high:e.high}):null!=e.value&&this._call("set_temperature",{temperature:e.value}))},t)}_onDialChanging(t){clearTimeout(this._tempTimer);const e=this._pending,i=t.detail;e&&e.value===i.value&&e.low===i.low&&e.high===i.high||this._haptic("selection"),this._pending={...i}}_onDialChanged(t){this._pending={...t.detail},this._scheduleTemp(400)}_stepTarget(t,e){const i=this._stateObj;if(!i)return;const s=this._step(i),n=Number(i.attributes.min_temp??7),o=Number(i.attributes.max_temp??35),r=this._targets(i),a=r[t]??this._currentTemp(i)??n;let c=Math.min(o,Math.max(n,Math.round((a+e*s)/s)*s));c=Number(c.toFixed(s<1?1:0)),"low"===t&&null!=r.high&&(c=Math.min(c,r.high)),"high"===t&&null!=r.low&&(c=Math.max(c,r.low)),c!==r[t]&&this._haptic("selection"),this._pending={...r,[t]:c},this._scheduleTemp(1e3)}_stepHumidity(t){const e=this._stateObj;if(!e)return;const i=Number(e.attributes.min_humidity??30),s=Number(e.attributes.max_humidity??99),n=this._pendingHumidity??Number(e.attributes.humidity??50);this._pendingHumidity=Math.min(s,Math.max(i,n+t)),clearTimeout(this._humTimer),this._humTimer=window.setTimeout(()=>this._call("set_humidity",{humidity:this._pendingHumidity}),1e3)}_setMode(t){this._haptic("light"),this._call("set_hvac_mode",{hvac_mode:t.detail.mode})}_togglePower(){this._haptic("light");const t=this._stateObj;if(!t)return;const e=t.attributes;if("off"===t.state)if(St(e,kt))this._call("turn_on");else{const t=e.hvac_modes?.find(t=>"off"!==t);t&&this._call("set_hvac_mode",{hvac_mode:t})}else St(e,$t)?this._call("turn_off"):this._call("set_hvac_mode",{hvac_mode:"off"})}_moreInfo(t){this.dispatchEvent(new CustomEvent("hass-more-info",{detail:{entityId:t??this._config?.entity},bubbles:!0,composed:!0}))}_renderHeader(t,e,i){const s=this._action(t),n=s?Ut(this.hass,t,"hvac_action",s):Rt(this.hass,t,t.state),o=(t.attributes.hvac_modes??[]).includes("off")||St(t.attributes,$t);return V`
      <div class="header">
        <button class="title" @click=${()=>this._moreInfo()}>
          <span class="icon-badge ${this._isActive(t)?"active":""}" data-action=${s??""} data-mode=${t.state}>
            <ha-icon .icon=${this._config.icon??ae(t,s)}></ha-icon>
          </span>
          <span class="names">
            <span class="name">${e}</span>
            <span class="status">${this._syncing?V`<span class="sync" title=${this._t("card.syncing")}></span>`:G}${n}</span>
          </span>
        </button>
        ${o?V`
          <button class="power ${"off"!==t.state?"on":""}"
            title=${this._t("off"===t.state?"card.turn_on":"card.turn_off")}
            aria-label=${this._t("off"===t.state?"card.turn_on":"card.turn_off")}
            @click=${this._togglePower}>
            <ha-icon icon="mdi:power"></ha-icon>
          </button>`:G}
      </div>
      ${this._renderPills(t)}`}_renderHints(t){const e=this._config,i=[];if(this._error&&i.push(V`<div class="banner error" role="alert" @click=${()=>this._error=void 0}>
        <ha-icon icon="mdi:alert-circle-outline"></ha-icon><div><strong>${this._error}</strong></div>
      </div>`),this._windowOpen()&&i.push(V`<div class="banner" @click=${()=>this._moreInfo(e.window_sensor)}>
        <ha-icon icon="mdi:window-open-variant"></ha-icon>
        <div><strong>${this._t("card.window_open")}</strong><span>${this._t("card.window_open_hint")}</span></div>
      </div>`),this._show.hints){const s=this._currentTemp(t),n=this._outdoorTemp(),o=e.ventilation_delta??3,r=this._action(t),a="cool"===t.state||"cooling"===r,c="heat"===t.state||"heating"===r;if(!this._windowOpen()&&null!=s&&null!=n){const t=t=>`${t.toFixed(1)}°`;a&&s-n>=o?i.push(V`<div class="banner info">
            <ha-icon icon="mdi:weather-windy"></ha-icon>
            <div><strong>${this._t("card.ventilate_cool")}</strong>
              <span>${this._t("card.outside")} ${t(n)} · ${this._t("card.inside")} ${t(s)} – ${this._t("card.ventilate_hint")}</span></div>
          </div>`):c&&n-s>=o&&i.push(V`<div class="banner info">
            <ha-icon icon="mdi:weather-windy"></ha-icon>
            <div><strong>${this._t("card.ventilate_heat")}</strong>
              <span>${this._t("card.outside")} ${t(n)} · ${this._t("card.inside")} ${t(s)} – ${this._t("card.ventilate_hint")}</span></div>
          </div>`)}const l=this._currentHumidity(t),h=e.humidity_warning??70;if(null!=l&&h>0&&l>=h){const e=null!=s?fe(s,l,this._unit):void 0,n=(t.attributes.hvac_modes??[]).includes("dry")&&"dry"!==t.state;i.push(V`<div class="banner humid">
          <ha-icon icon="mdi:water-alert"></ha-icon>
          <div><strong>${this._t("card.humidity_high")} (${Math.round(l)} %)</strong>
            <span>${this._t("card.mold_hint")}${null!=e?` · ${this._t("card.dew_point")} ${e.toFixed(1)}°`:""}</span></div>
          ${n?V`<button class="banner-action" @click=${()=>this._call("set_hvac_mode",{hvac_mode:"dry"})}>
            ${this._t("card.start_dry")}</button>`:G}
        </div>`)}}return i.length?V`<div class="hints">${i}</div>`:G}_renderStepper(t,e,i,s){return V`<div class="stepper" style=${s&&s!==Me?`--accent:${s}`:""}>
      ${this._holdButton("-","mdi:minus",()=>this._stepTarget(t,-1))}
      <span class="stepper-value" data-pop=${`step-${t}`}>${this._fmt(e,i)}<small>${this._unit}</small></span>
      ${this._holdButton("+","mdi:plus",()=>this._stepTarget(t,1))}
    </div>`}_renderDial(t,e){const i=t.attributes,s=this._step(t),n=this._isDual(t),o=this._targets(t),r=this._currentTemp(t),a="off"===t.state,c=n||null!=o.value&&St(i,gt),l=this._currentHumidity(t);return V`
      <hcc-climate-dial
        .min=${Number(i.min_temp??7)} .max=${Number(i.max_temp??35)} .step=${s}
        .value=${o.value} .low=${o.low} .high=${o.high} .current=${r}
        .dual=${n} .disabled=${a||!c} .color=${e} .active=${this._isActive(t)}
        .fade=${["dry","fan_only"].includes(t.state)}
        @value-changing=${this._onDialChanging} @value-changed=${this._onDialChanged}>
        <div class="dial-center">
          <span class="dial-label">${a?Rt(this.hass,t,"off"):this._t("card.target")}</span>
          ${a||!c?V`<span class="dial-big">${this._fmt(r,s)}<sup>${this._unit}</sup></span>`:n?V`<span class="dial-range">
                  <span style="color:var(--state-climate-heat-color,#ff6d00)">${this._fmt(o.low,s)}</span>
                  <span class="sep">–</span>
                  <span style="color:var(--state-climate-cool-color,#2196f3)">${this._fmt(o.high,s)}</span>
                </span>`:V`<span class="dial-big" data-pop="target">${this._fmt(o.value,s)}<sup>${this._unit}</sup></span>`}
          <span class="dial-sub">
            ${!a&&c?V`<ha-icon icon="mdi:home-thermometer-outline"></ha-icon><span
              style=${`color:${ve(r,this._goal(t))??"inherit"}`}>${this._fmt(r,s)}${this._unit}</span>`:G}
            ${null!=l?V`<ha-icon icon="mdi:water-percent"></ha-icon>${Math.round(Number(l))}%`:G}
          </span>
          ${this._etaText(t)?V`<span class="eta"><ha-icon icon="mdi:timer-sand"></ha-icon>${this._etaText(t)}</span>`:G}
        </div>
      </hcc-climate-dial>
      ${!a&&c?V`<div class="dial-steppers ${n?"dual":""}">
        ${n?V`${this._renderStepper("low",o.low,s,"var(--state-climate-heat-color,#ff6d00)")}
                 ${this._renderStepper("high",o.high,s,"var(--state-climate-cool-color,#2196f3)")}`:V`${this._holdButton("-","mdi:minus",()=>this._stepTarget("value",-1),"round")}
                 ${this._holdButton("+","mdi:plus",()=>this._stepTarget("value",1),"round")}`}
      </div>`:G}`}_sections(t,e){const i=t.attributes,s=this._show,n=this.hass,o=[],r=(t,e)=>o.push({key:e,tpl:t}),a=(i.hvac_modes??[]).slice().sort((t,e)=>Ct.indexOf(t)-Ct.indexOf(e)).map(e=>({value:e,label:Rt(n,t,e)}));s.modes&&a.length>1&&r(V`<hcc-mode-bar .modes=${a} .selected=${t.state} @mode-selected=${this._setMode}></hcc-mode-bar>`,"modes");const c=(e,s,o,a,c,l,h,d)=>{const p=i[o];d&&St(i,a)&&p?.length&&r(V`<hcc-attribute-select .label=${this._t(c)} .icon=${l} .selected=${i[s]}
        .options=${p.map(e=>({value:e,label:Ut(n,t,s,e)}))}
        .dropdownThreshold=${this._config.dropdown_threshold??6}
        @option-selected=${t=>{this._haptic("selection"),this._call(h,{[s]:t.detail.value})}}>
      </hcc-attribute-select>`,e)};if(c("fan","fan_mode","fan_modes",yt,"card.fan","mdi:fan","set_fan_mode",s.fan),c("swing","swing_mode","swing_modes",xt,"card.swing","mdi:arrow-oscillating","set_swing_mode",s.swing),c("swing","swing_horizontal_mode","swing_horizontal_modes",At,"card.swing_horizontal","mdi:arrow-left-right","set_swing_horizontal_mode",s.swing),c("presets","preset_mode","preset_modes",wt,"card.preset","mdi:star-outline","set_preset_mode",s.presets),s.timer&&(this._config.timer_switch||this._config.timer_time)&&r(V`<hcc-sleep-timer .hass=${n} .switchEntity=${this._config.timer_switch}
        .timeEntity=${this._config.timer_time} .label=${this._t("card.sleep_timer")} .offText=${this._t("card.timer_off")}
        .atText=${this._t("card.timer_at")} .inText=${this._t("card.timer_in")}></hcc-sleep-timer>`,"timer"),s.timer&&this._config.countdown_timer&&n.states[this._config.countdown_timer]&&r(V`<hcc-countdown-timer .hass=${n} .entity=${this._config.countdown_timer}
        .durations=${this._config.countdown_durations??[30,60,90,120]}
        .label=${this._t("card.countdown")} .cancelText=${this._t("card.cancel")}></hcc-countdown-timer>`,"countdown"),s.shortcuts){const e=this._shortcutItems(t);e.length&&r(V`<hcc-shortcut-row .hass=${n} .items=${e}></hcc-shortcut-row>`,"shortcuts")}if(s.humidity&&St(i,vt)&&null!=i.humidity){const t=this._pendingHumidity??Number(i.humidity);r(V`<div class="humidity-row">
        <span class="row-label"><ha-icon icon="mdi:water-percent"></ha-icon>${this._t("card.target_humidity")}</span>
        <div class="stepper">
          ${this._holdButton("-","mdi:minus",()=>this._stepHumidity(-1))}
          <span class="stepper-value" data-pop="humidity">${t}<small>%</small></span>
          ${this._holdButton("+","mdi:plus",()=>this._stepHumidity(1))}
        </div>
      </div>`,"humidity")}if(s.sensors){const e=this._sensorItems(t);e.length&&r(V`<hcc-sensor-row .items=${e}></hcc-sensor-row>`,"sensors")}const l=this._expanded||"compact"!==this._config.layout&&!1===this._config.expandable;return s.graph&&r(V`<div class="graph-wrap">
        <span class="row-label"><ha-icon icon="mdi:chart-line"></ha-icon>${this._t("card.history")}</span>
        ${this._graphLoaded||l?V`<hcc-history-graph .hass=${n} .entity=${t.entity_id}
          .sensor=${this._externalTemp?.entity_id}
          .hours=${this._config.graph_hours??24} .unit=${this._unit} .emptyText=${this._t("card.no_history")}
          style="--hcc-accent:${e}"></hcc-history-graph>`:V`<div class="graph-placeholder"></div>`}
      </div>`,"graph"),o}_renderSections(t,e){return t.length?V`<div class="controls" style="--hcc-accent:${e}">${t.map(t=>t.tpl)}</div>`:G}_renderCollapsible(t){return V`<div class="collapsible ${this._expanded?"open":""}" ?inert=${!this._expanded} aria-hidden=${!this._expanded}>
      <div class="collapsible-inner">${t}</div>
    </div>`}_renderExpandButton(){return V`<button class="expand" @click=${()=>{this._expanded=!this._expanded}} aria-expanded=${this._expanded}>
      <span>${this._t(this._expanded?"card.less":"card.more")}</span>
      <ha-icon class="chevron" icon="mdi:chevron-down"></ha-icon>
    </button>`}_renderFullControls(t,e){const i=this._sections(t,e);if(!1===this._config.expandable)return this._renderSections(i,e);const s=i.filter(t=>Ht.includes(t.key)),n=i.filter(t=>!Ht.includes(t.key));return V`
      ${this._renderSections(s,e)}
      ${n.length?V`
        ${this._renderCollapsible(this._renderSections(n,e))}
        ${this._renderExpandButton()}`:G}`}_sensorItems(t){const e=this._config,i=[],s=(t,e,s,n=!1)=>{const o=this._sensorState(t);null!=o&&i.push({entity:t,icon:e,label:this._t(s),value:o,warning:n})};if(e.temperature_sensor&&!1===e.use_sensor_for_current){const t=this.hass.states[e.temperature_sensor],s=this._tempOf(t);t&&i.push({entity:t.entity_id,icon:"mdi:home-thermometer-outline",label:this._t("card.current"),value:null!=s?`${s} ${this._unit}`:"–"})}const n=this._currentHumidity(t);if("compact"===this._config?.layout&&null!=n&&i.push({entity:e.humidity_sensor,icon:"mdi:water-percent",label:this._t("card.humidity"),value:`${Math.round(n)} %`}),null!=this._runtimeToday&&this._runtimeToday>=60&&i.push({icon:"mdi:timer-sand",label:this._t("card.runtime_today"),value:this._fmtDuration(this._runtimeToday)}),s(e.outdoor_sensor,"mdi:thermometer","card.outdoor"),e.weather_entity&&this.hass.states[e.weather_entity]){const t=this.hass.states[e.weather_entity],s=this._forecast,n=s?.condition??t.state,o=null!=s?.temperature?`${Math.round(s.temperature)}°${null!=s.templow?` / ${Math.round(s.templow)}°`:""}`:this._sensorState(e.weather_entity)??"–",r=s?.precipitation_probability?` · ☂ ${s.precipitation_probability} %`:"";i.push({entity:e.weather_entity,icon:_e[n]??"mdi:weather-partly-cloudy",label:`${this._t("card.today")}${r}`,value:o})}if(this._show.hints){const s=this._currentTemp(t),n=this._currentHumidity(t),o=null!=s&&null!=n?fe(s,n,this._unit):void 0;null!=o&&i.push({icon:"mdi:water-thermometer-outline",label:this._t("card.dew_point"),value:`${o.toFixed(1)} ${this._unit}`,warning:n>=(e.humidity_warning??70)})}if(s(e.power_sensor,"mdi:flash","card.power"),s(e.energy_sensor,"mdi:lightning-bolt","card.energy"),e.window_sensor&&this.hass.states[e.window_sensor]){const t=this._windowOpen();i.push({entity:e.window_sensor,icon:t?"mdi:window-open-variant":"mdi:window-closed-variant",label:this.hass.states[e.window_sensor].attributes.friendly_name??"Window",value:this._sensorState(e.window_sensor)??"",warning:t})}return i}_renderGauge(t){if("off"===t.state)return G;const e=t.attributes,i=Number(e.min_temp??7),s=Number(e.max_temp??35),n=t=>`${(100*Math.min(1,Math.max(0,(t-i)/(s-i||1)))).toFixed(2)}%`,o=this._currentTemp(t),r=this._targets(t),a=this._isDual(t),c="var(--state-climate-heat-color, #ff6d00)",l="var(--state-climate-cool-color, #2196f3)";let h=G;if(a&&null!=r.low&&null!=r.high)h=V`<span class="g-zone" style="left:${n(r.low)};right:calc(100% - ${n(r.high)});background:linear-gradient(90deg, ${c}, ${l})"></span>`;else if(null!=o&&null!=r.value){const e=Math.min(o,r.value),i=Math.max(o,r.value),s=["dry","fan_only"].includes(t.state)?"color-mix(in srgb, var(--accent) 25%, transparent)":o>r.value?c:l,[a,d]=o<r.value?[s,"var(--accent)"]:["var(--accent)",s];h=V`<span class="g-seg ${this._isActive(t)?"flowing":""} ${o<r.value?"up":"down"}"
        style="left:${n(e)};right:calc(100% - ${n(i)});--c1:${a};--c2:${d}"></span>`}return V`<div class="gauge" aria-hidden="true">
      <span class="g-track"></span>
      ${h}
      ${null!=o?V`<span class="g-cur" style="left:${n(o)}"></span>`:G}
      ${a?V`<span class="g-knob" style="left:${n(r.low??i)};--k:${c}"></span><span class="g-knob" style="left:${n(r.high??s)};--k:${l}"></span>`:null!=r.value?V`<span class="g-knob" style="left:${n(r.value)};--k:var(--accent)"></span>`:G}
    </div>
    ${this._etaText(t)?V`<span class="eta compact-eta"><ha-icon icon="mdi:timer-sand"></ha-icon>${this._etaText(t)}</span>`:G}`}_renderCompact(t,e,i){const s=this._step(t),n=this._isDual(t),o=this._targets(t),r="off"===t.state,a=n||null!=o.value&&St(t.attributes,gt),c=this._currentTemp(t);return V`
      <div class="compact-top">
        ${this._renderHeader(t,e,i)}
      </div>
      <div class="compact-row">
        <div class="compact-current">
          <span class="big" style=${`color:${r?"inherit":ve(c,this._goal(t))??"inherit"}`}>${this._fmt(c,s)}<sup>${this._unit}</sup></span>
          <span class="dial-label">${this._t("card.current")}</span>
        </div>
        ${!r&&a?n?V`<div class="compact-steppers">
                ${this._renderStepper("low",o.low,s,"var(--state-climate-heat-color,#ff6d00)")}
                ${this._renderStepper("high",o.high,s,"var(--state-climate-cool-color,#2196f3)")}
              </div>`:this._renderStepper("value",o.value,s,i):G}
      </div>
      ${this._renderGauge(t)}
      ${this._renderHints(t)}
      ${this._renderExpandButton()}
      ${this._renderCollapsible(this._renderSections(this._sections(t,i),i))}`}_renderAirflow(t,e){if(!this._show.airflow||!this._isActive(t)||"full"!==(this._config.animations??"full"))return G;const i=t.attributes,s=i.fan_modes??[],n=s.indexOf(i.fan_mode),o=/auto/i.test(i.fan_mode??""),r=n<0||o?.5:s.filter(t=>!/auto/i.test(t)).indexOf(i.fan_mode)/Math.max(1,s.filter(t=>!/auto/i.test(t)).length-1),a=t=>!!t&&/swing|^on$|both|vertical|auto/i.test(t)&&!/fixed/i.test(t),c=a(i.swing_mode)&&!/^horizontal$/i.test(i.swing_mode),l=a(i.swing_horizontal_mode)||/both|horizontal/i.test(i.swing_mode??""),h=this._action(t),d="heating"===h||"preheating"===h?"heat":"cooling"===h?"cool":"neutral";return V`<hcc-airflow .speed=${Math.max(0,Math.min(1,r))} .swingVertical=${c} .swingHorizontal=${l}
      .color=${e} .variant=${d}></hcc-airflow>`}render(){if(!this._config||!this.hass)return G;const t=this._stateObj;if(!t)return V`<ha-card><div class="warning">${this._t("card.entity_not_found")}: ${this._config.entity}</div></ha-card>`;const e=this._config.name??t.attributes.friendly_name??t.entity_id;if(ze.includes(t.state))return V`<ha-card class="unavailable" style="--hcc-accent-c:${Mt.off}">
        ${this._renderHeader(t,e,Mt.off)}
        <div class="warning">${this._t("card.unavailable")}</div>
      </ha-card>`;const i=Me,s="compact"===this._config.layout,n="off"===t.state?"off":this._isActive(t)?"active":"idle",o=this._config.animations??"full";return V`<ha-card class="${s?"compact":"full"} ${n} anim-${o}" style="--hcc-accent-c:${this._modeColor(t)}">
      <div class="glow"><span class="blob b1"></span><span class="blob b2"></span></div>
      ${this._renderAirflow(t,i)}
      ${s?this._renderCompact(t,e,i):V`
          ${this._renderHeader(t,e,i)}
          ${this._renderHints(t)}
          ${this._renderDial(t,i)}
          ${this._renderFullControls(t,i)}`}
    </ha-card>`}};Ne.styles=jt,t([mt({attribute:!1})],Ne.prototype,"hass",void 0),t([ft()],Ne.prototype,"_config",void 0),t([ft()],Ne.prototype,"_pending",void 0),t([ft()],Ne.prototype,"_pendingHumidity",void 0),t([ft()],Ne.prototype,"_expanded",void 0),t([ft()],Ne.prototype,"_forecast",void 0),t([ft()],Ne.prototype,"_syncing",void 0),t([ft()],Ne.prototype,"_graphLoaded",void 0),t([ft()],Ne.prototype,"_runtimeToday",void 0),t([ft()],Ne.prototype,"_samples",void 0),t([ft()],Ne.prototype,"_error",void 0),Ne=t([dt("ha-climate-card")],Ne);export{Ne as HaClimateCard};
