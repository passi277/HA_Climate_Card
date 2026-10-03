function t(t,e,i,s){var o,n=arguments.length,r=n<3?e:null===s?s=Object.getOwnPropertyDescriptor(e,i):s;if("object"==typeof Reflect&&"function"==typeof Reflect.decorate)r=Reflect.decorate(t,e,i,s);else for(var a=t.length-1;a>=0;a--)(o=t[a])&&(r=(n<3?o(r):n>3?o(e,i,r):o(e,i))||r);return n>3&&r&&Object.defineProperty(e,i,r),r}"function"==typeof SuppressedError&&SuppressedError;const e=globalThis,i=e.ShadowRoot&&(void 0===e.ShadyCSS||e.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,s=Symbol(),o=new WeakMap;let n=class{constructor(t,e,i){if(this._$cssResult$=!0,i!==s)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=t,this.t=e}get styleSheet(){let t=this.o;const e=this.t;if(i&&void 0===t){const i=void 0!==e&&1===e.length;i&&(t=o.get(e)),void 0===t&&((this.o=t=new CSSStyleSheet).replaceSync(this.cssText),i&&o.set(e,t))}return t}toString(){return this.cssText}};const r=(t,...e)=>{const i=1===t.length?t[0]:e.reduce((e,i,s)=>e+(t=>{if(!0===t._$cssResult$)return t.cssText;if("number"==typeof t)return t;throw Error("Value passed to 'css' function must be a 'css' function result: "+t+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(i)+t[s+1],t[0]);return new n(i,t,s)},a=i?t=>t:t=>t instanceof CSSStyleSheet?(t=>{let e="";for(const i of t.cssRules)e+=i.cssText;return(t=>new n("string"==typeof t?t:t+"",void 0,s))(e)})(t):t,{is:l,defineProperty:c,getOwnPropertyDescriptor:h,getOwnPropertyNames:d,getOwnPropertySymbols:p,getPrototypeOf:u}=Object,m=globalThis,_=m.trustedTypes,f=_?_.emptyScript:"",g=m.reactiveElementPolyfillSupport,y=(t,e)=>t,v={toAttribute(t,e){switch(e){case Boolean:t=t?f:null;break;case Object:case Array:t=null==t?t:JSON.stringify(t)}return t},fromAttribute(t,e){let i=t;switch(e){case Boolean:i=null!==t;break;case Number:i=null===t?null:Number(t);break;case Object:case Array:try{i=JSON.parse(t)}catch(t){i=null}}return i}},b=(t,e)=>!l(t,e),w={attribute:!0,type:String,converter:v,reflect:!1,useDefault:!1,hasChanged:b};Symbol.metadata??=Symbol("metadata"),m.litPropertyMetadata??=new WeakMap;let $=class extends HTMLElement{static addInitializer(t){this._$Ei(),(this.l??=[]).push(t)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(t,e=w){if(e.state&&(e.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(t)&&((e=Object.create(e)).wrapped=!0),this.elementProperties.set(t,e),!e.noAccessor){const i=Symbol(),s=this.getPropertyDescriptor(t,i,e);void 0!==s&&c(this.prototype,t,s)}}static getPropertyDescriptor(t,e,i){const{get:s,set:o}=h(this.prototype,t)??{get(){return this[e]},set(t){this[e]=t}};return{get:s,set(e){const n=s?.call(this);o?.call(this,e),this.requestUpdate(t,n,i)},configurable:!0,enumerable:!0}}static getPropertyOptions(t){return this.elementProperties.get(t)??w}static _$Ei(){if(this.hasOwnProperty(y("elementProperties")))return;const t=u(this);t.finalize(),void 0!==t.l&&(this.l=[...t.l]),this.elementProperties=new Map(t.elementProperties)}static finalize(){if(this.hasOwnProperty(y("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(y("properties"))){const t=this.properties,e=[...d(t),...p(t)];for(const i of e)this.createProperty(i,t[i])}const t=this[Symbol.metadata];if(null!==t){const e=litPropertyMetadata.get(t);if(void 0!==e)for(const[t,i]of e)this.elementProperties.set(t,i)}this._$Eh=new Map;for(const[t,e]of this.elementProperties){const i=this._$Eu(t,e);void 0!==i&&this._$Eh.set(i,t)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(t){const e=[];if(Array.isArray(t)){const i=new Set(t.flat(1/0).reverse());for(const t of i)e.unshift(a(t))}else void 0!==t&&e.push(a(t));return e}static _$Eu(t,e){const i=e.attribute;return!1===i?void 0:"string"==typeof i?i:"string"==typeof t?t.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){this._$ES=new Promise(t=>this.enableUpdating=t),this._$AL=new Map,this._$E_(),this.requestUpdate(),this.constructor.l?.forEach(t=>t(this))}addController(t){(this._$EO??=new Set).add(t),void 0!==this.renderRoot&&this.isConnected&&t.hostConnected?.()}removeController(t){this._$EO?.delete(t)}_$E_(){const t=new Map,e=this.constructor.elementProperties;for(const i of e.keys())this.hasOwnProperty(i)&&(t.set(i,this[i]),delete this[i]);t.size>0&&(this._$Ep=t)}createRenderRoot(){const t=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return((t,s)=>{if(i)t.adoptedStyleSheets=s.map(t=>t instanceof CSSStyleSheet?t:t.styleSheet);else for(const i of s){const s=document.createElement("style"),o=e.litNonce;void 0!==o&&s.setAttribute("nonce",o),s.textContent=i.cssText,t.appendChild(s)}})(t,this.constructor.elementStyles),t}connectedCallback(){this.renderRoot??=this.createRenderRoot(),this.enableUpdating(!0),this._$EO?.forEach(t=>t.hostConnected?.())}enableUpdating(t){}disconnectedCallback(){this._$EO?.forEach(t=>t.hostDisconnected?.())}attributeChangedCallback(t,e,i){this._$AK(t,i)}_$ET(t,e){const i=this.constructor.elementProperties.get(t),s=this.constructor._$Eu(t,i);if(void 0!==s&&!0===i.reflect){const o=(void 0!==i.converter?.toAttribute?i.converter:v).toAttribute(e,i.type);this._$Em=t,null==o?this.removeAttribute(s):this.setAttribute(s,o),this._$Em=null}}_$AK(t,e){const i=this.constructor,s=i._$Eh.get(t);if(void 0!==s&&this._$Em!==s){const t=i.getPropertyOptions(s),o="function"==typeof t.converter?{fromAttribute:t.converter}:void 0!==t.converter?.fromAttribute?t.converter:v;this._$Em=s;const n=o.fromAttribute(e,t.type);this[s]=n??this._$Ej?.get(s)??n,this._$Em=null}}requestUpdate(t,e,i,s=!1,o){if(void 0!==t){const n=this.constructor;if(!1===s&&(o=this[t]),i??=n.getPropertyOptions(t),!((i.hasChanged??b)(o,e)||i.useDefault&&i.reflect&&o===this._$Ej?.get(t)&&!this.hasAttribute(n._$Eu(t,i))))return;this.C(t,e,i)}!1===this.isUpdatePending&&(this._$ES=this._$EP())}C(t,e,{useDefault:i,reflect:s,wrapped:o},n){i&&!(this._$Ej??=new Map).has(t)&&(this._$Ej.set(t,n??e??this[t]),!0!==o||void 0!==n)||(this._$AL.has(t)||(this.hasUpdated||i||(e=void 0),this._$AL.set(t,e)),!0===s&&this._$Em!==t&&(this._$Eq??=new Set).add(t))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(t){Promise.reject(t)}const t=this.scheduleUpdate();return null!=t&&await t,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??=this.createRenderRoot(),this._$Ep){for(const[t,e]of this._$Ep)this[t]=e;this._$Ep=void 0}const t=this.constructor.elementProperties;if(t.size>0)for(const[e,i]of t){const{wrapped:t}=i,s=this[e];!0!==t||this._$AL.has(e)||void 0===s||this.C(e,void 0,i,s)}}let t=!1;const e=this._$AL;try{t=this.shouldUpdate(e),t?(this.willUpdate(e),this._$EO?.forEach(t=>t.hostUpdate?.()),this.update(e)):this._$EM()}catch(e){throw t=!1,this._$EM(),e}t&&this._$AE(e)}willUpdate(t){}_$AE(t){this._$EO?.forEach(t=>t.hostUpdated?.()),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(t)),this.updated(t)}_$EM(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(t){return!0}update(t){this._$Eq&&=this._$Eq.forEach(t=>this._$ET(t,this[t])),this._$EM()}updated(t){}firstUpdated(t){}};$.elementStyles=[],$.shadowRootOptions={mode:"open"},$[y("elementProperties")]=new Map,$[y("finalized")]=new Map,g?.({ReactiveElement:$}),(m.reactiveElementVersions??=[]).push("2.1.2");const x=globalThis,A=t=>t,k=x.trustedTypes,S=k?k.createPolicy("lit-html",{createHTML:t=>t}):void 0,E="$lit$",C=`lit$${Math.random().toFixed(9).slice(2)}$`,T="?"+C,N=`<${T}>`,P=document,M=()=>P.createComment(""),H=t=>null===t||"object"!=typeof t&&"function"!=typeof t,O=Array.isArray,z="[ \t\n\f\r]",U=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,D=/-->/g,j=/>/g,R=RegExp(`>|${z}(?:([^\\s"'>=/]+)(${z}*=${z}*(?:[^ \t\n\f\r"'\`<>=]|("|')|))|$)`,"g"),I=/'/g,L=/"/g,F=/^(?:script|style|textarea|title)$/i,B=t=>(e,...i)=>({_$litType$:t,strings:e,values:i}),W=B(1),V=B(2),K=Symbol.for("lit-noChange"),q=Symbol.for("lit-nothing"),G=new WeakMap,Z=P.createTreeWalker(P,129);function J(t,e){if(!O(t)||!t.hasOwnProperty("raw"))throw Error("invalid template strings array");return void 0!==S?S.createHTML(e):e}const X=(t,e)=>{const i=t.length-1,s=[];let o,n=2===e?"<svg>":3===e?"<math>":"",r=U;for(let e=0;e<i;e++){const i=t[e];let a,l,c=-1,h=0;for(;h<i.length&&(r.lastIndex=h,l=r.exec(i),null!==l);)h=r.lastIndex,r===U?"!--"===l[1]?r=D:void 0!==l[1]?r=j:void 0!==l[2]?(F.test(l[2])&&(o=RegExp("</"+l[2],"g")),r=R):void 0!==l[3]&&(r=R):r===R?">"===l[0]?(r=o??U,c=-1):void 0===l[1]?c=-2:(c=r.lastIndex-l[2].length,a=l[1],r=void 0===l[3]?R:'"'===l[3]?L:I):r===L||r===I?r=R:r===D||r===j?r=U:(r=R,o=void 0);const d=r===R&&t[e+1].startsWith("/>")?" ":"";n+=r===U?i+N:c>=0?(s.push(a),i.slice(0,c)+E+i.slice(c)+C+d):i+C+(-2===c?e:d)}return[J(t,n+(t[i]||"<?>")+(2===e?"</svg>":3===e?"</math>":"")),s]};class Y{constructor({strings:t,_$litType$:e},i){let s;this.parts=[];let o=0,n=0;const r=t.length-1,a=this.parts,[l,c]=X(t,e);if(this.el=Y.createElement(l,i),Z.currentNode=this.el.content,2===e||3===e){const t=this.el.content.firstChild;t.replaceWith(...t.childNodes)}for(;null!==(s=Z.nextNode())&&a.length<r;){if(1===s.nodeType){if(s.hasAttributes())for(const t of s.getAttributeNames())if(t.endsWith(E)){const e=c[n++],i=s.getAttribute(t).split(C),r=/([.?@])?(.*)/.exec(e);a.push({type:1,index:o,name:r[2],strings:i,ctor:"."===r[1]?st:"?"===r[1]?ot:"@"===r[1]?nt:it}),s.removeAttribute(t)}else t.startsWith(C)&&(a.push({type:6,index:o}),s.removeAttribute(t));if(F.test(s.tagName)){const t=s.textContent.split(C),e=t.length-1;if(e>0){s.textContent=k?k.emptyScript:"";for(let i=0;i<e;i++)s.append(t[i],M()),Z.nextNode(),a.push({type:2,index:++o});s.append(t[e],M())}}}else if(8===s.nodeType)if(s.data===T)a.push({type:2,index:o});else{let t=-1;for(;-1!==(t=s.data.indexOf(C,t+1));)a.push({type:7,index:o}),t+=C.length-1}o++}}static createElement(t,e){const i=P.createElement("template");return i.innerHTML=t,i}}function Q(t,e,i=t,s){if(e===K)return e;let o=void 0!==s?i._$Co?.[s]:i._$Cl;const n=H(e)?void 0:e._$litDirective$;return o?.constructor!==n&&(o?._$AO?.(!1),void 0===n?o=void 0:(o=new n(t),o._$AT(t,i,s)),void 0!==s?(i._$Co??=[])[s]=o:i._$Cl=o),void 0!==o&&(e=Q(t,o._$AS(t,e.values),o,s)),e}let tt=class{constructor(t,e){this._$AV=[],this._$AN=void 0,this._$AD=t,this._$AM=e}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(t){const{el:{content:e},parts:i}=this._$AD,s=(t?.creationScope??P).importNode(e,!0);Z.currentNode=s;let o=Z.nextNode(),n=0,r=0,a=i[0];for(;void 0!==a;){if(n===a.index){let e;2===a.type?e=new et(o,o.nextSibling,this,t):1===a.type?e=new a.ctor(o,a.name,a.strings,this,t):6===a.type&&(e=new rt(o,this,t)),this._$AV.push(e),a=i[++r]}n!==a?.index&&(o=Z.nextNode(),n++)}return Z.currentNode=P,s}p(t){let e=0;for(const i of this._$AV)void 0!==i&&(void 0!==i.strings?(i._$AI(t,i,e),e+=i.strings.length-2):i._$AI(t[e])),e++}};class et{get _$AU(){return this._$AM?._$AU??this._$Cv}constructor(t,e,i,s){this.type=2,this._$AH=q,this._$AN=void 0,this._$AA=t,this._$AB=e,this._$AM=i,this.options=s,this._$Cv=s?.isConnected??!0}get parentNode(){let t=this._$AA.parentNode;const e=this._$AM;return void 0!==e&&11===t?.nodeType&&(t=e.parentNode),t}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(t,e=this){t=Q(this,t,e),H(t)?t===q||null==t||""===t?(this._$AH!==q&&this._$AR(),this._$AH=q):t!==this._$AH&&t!==K&&this._(t):void 0!==t._$litType$?this.$(t):void 0!==t.nodeType?this.T(t):(t=>O(t)||"function"==typeof t?.[Symbol.iterator])(t)?this.k(t):this._(t)}O(t){return this._$AA.parentNode.insertBefore(t,this._$AB)}T(t){this._$AH!==t&&(this._$AR(),this._$AH=this.O(t))}_(t){this._$AH!==q&&H(this._$AH)?this._$AA.nextSibling.data=t:this.T(P.createTextNode(t)),this._$AH=t}$(t){const{values:e,_$litType$:i}=t,s="number"==typeof i?this._$AC(t):(void 0===i.el&&(i.el=Y.createElement(J(i.h,i.h[0]),this.options)),i);if(this._$AH?._$AD===s)this._$AH.p(e);else{const t=new tt(s,this),i=t.u(this.options);t.p(e),this.T(i),this._$AH=t}}_$AC(t){let e=G.get(t.strings);return void 0===e&&G.set(t.strings,e=new Y(t)),e}k(t){O(this._$AH)||(this._$AH=[],this._$AR());const e=this._$AH;let i,s=0;for(const o of t)s===e.length?e.push(i=new et(this.O(M()),this.O(M()),this,this.options)):i=e[s],i._$AI(o),s++;s<e.length&&(this._$AR(i&&i._$AB.nextSibling,s),e.length=s)}_$AR(t=this._$AA.nextSibling,e){for(this._$AP?.(!1,!0,e);t!==this._$AB;){const e=A(t).nextSibling;A(t).remove(),t=e}}setConnected(t){void 0===this._$AM&&(this._$Cv=t,this._$AP?.(t))}}let it=class{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(t,e,i,s,o){this.type=1,this._$AH=q,this._$AN=void 0,this.element=t,this.name=e,this._$AM=s,this.options=o,i.length>2||""!==i[0]||""!==i[1]?(this._$AH=Array(i.length-1).fill(new String),this.strings=i):this._$AH=q}_$AI(t,e=this,i,s){const o=this.strings;let n=!1;if(void 0===o)t=Q(this,t,e,0),n=!H(t)||t!==this._$AH&&t!==K,n&&(this._$AH=t);else{const s=t;let r,a;for(t=o[0],r=0;r<o.length-1;r++)a=Q(this,s[i+r],e,r),a===K&&(a=this._$AH[r]),n||=!H(a)||a!==this._$AH[r],a===q?t=q:t!==q&&(t+=(a??"")+o[r+1]),this._$AH[r]=a}n&&!s&&this.j(t)}j(t){t===q?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,t??"")}};class st extends it{constructor(){super(...arguments),this.type=3}j(t){this.element[this.name]=t===q?void 0:t}}class ot extends it{constructor(){super(...arguments),this.type=4}j(t){this.element.toggleAttribute(this.name,!!t&&t!==q)}}class nt extends it{constructor(t,e,i,s,o){super(t,e,i,s,o),this.type=5}_$AI(t,e=this){if((t=Q(this,t,e,0)??q)===K)return;const i=this._$AH,s=t===q&&i!==q||t.capture!==i.capture||t.once!==i.once||t.passive!==i.passive,o=t!==q&&(i===q||s);s&&this.element.removeEventListener(this.name,this,i),o&&this.element.addEventListener(this.name,this,t),this._$AH=t}handleEvent(t){"function"==typeof this._$AH?this._$AH.call(this.options?.host??this.element,t):this._$AH.handleEvent(t)}}class rt{constructor(t,e,i){this.element=t,this.type=6,this._$AN=void 0,this._$AM=e,this.options=i}get _$AU(){return this._$AM._$AU}_$AI(t){Q(this,t)}}const at=x.litHtmlPolyfillSupport;at?.(Y,et),(x.litHtmlVersions??=[]).push("3.3.3");const lt=globalThis;class ct extends ${constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){const t=super.createRenderRoot();return this.renderOptions.renderBefore??=t.firstChild,t}update(t){const e=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(t),this._$Do=((t,e,i)=>{const s=i?.renderBefore??e;let o=s._$litPart$;if(void 0===o){const t=i?.renderBefore??null;s._$litPart$=o=new et(e.insertBefore(M(),t),t,void 0,i??{})}return o._$AI(t),o})(e,this.renderRoot,this.renderOptions)}connectedCallback(){super.connectedCallback(),this._$Do?.setConnected(!0)}disconnectedCallback(){super.disconnectedCallback(),this._$Do?.setConnected(!1)}render(){return K}}ct._$litElement$=!0,ct.finalized=!0,lt.litElementHydrateSupport?.({LitElement:ct});const ht=lt.litElementPolyfillSupport;ht?.({LitElement:ct}),(lt.litElementVersions??=[]).push("4.2.2");const dt=t=>(e,i)=>{void 0!==i?i.addInitializer(()=>{customElements.define(t,e)}):customElements.define(t,e)},pt={attribute:!0,type:String,converter:v,reflect:!1,hasChanged:b},ut=(t=pt,e,i)=>{const{kind:s,metadata:o}=i;let n=globalThis.litPropertyMetadata.get(o);if(void 0===n&&globalThis.litPropertyMetadata.set(o,n=new Map),"setter"===s&&((t=Object.create(t)).wrapped=!0),n.set(i.name,t),"accessor"===s){const{name:s}=i;return{set(i){const o=e.get.call(this);e.set.call(this,i),this.requestUpdate(s,o,t,!0,i)},init(e){return void 0!==e&&this.C(s,void 0,t,e),e}}}if("setter"===s){const{name:s}=i;return function(i){const o=this[s];e.call(this,i),this.requestUpdate(s,o,t,!0,i)}}throw Error("Unsupported decorator location: "+s)};function mt(t){return(e,i)=>"object"==typeof i?ut(t,e,i):((t,e,i)=>{const s=e.hasOwnProperty(i);return e.constructor.createProperty(i,t),s?Object.getOwnPropertyDescriptor(e,i):void 0})(t,e,i)}function _t(t){return mt({...t,state:!0,attribute:!1})}const ft=1,gt=2,yt=4,vt=8,bt=16,wt=32,$t=128,xt=256,At=512,kt=(t,e)=>0!==((t.supported_features??0)&e),St=["auto","heat_cool","heat","cool","dry","fan_only","off"],Et={auto:"mdi:thermostat-auto",heat_cool:"mdi:sun-snowflake-variant",heat:"mdi:fire",cool:"mdi:snowflake",dry:"mdi:water-percent",fan_only:"mdi:fan",off:"mdi:power"},Ct={heating:"mdi:fire",cooling:"mdi:snowflake",drying:"mdi:water-percent",fan:"mdi:fan",idle:"mdi:clock-outline",off:"mdi:power",preheating:"mdi:heat-wave",defrosting:"mdi:snowflake-melt"},Tt={auto:"var(--state-climate-auto-color, #43a047)",heat_cool:"var(--state-climate-heat_cool-color, #ffa000)",heat:"var(--state-climate-heat-color, #ff6d00)",cool:"var(--state-climate-cool-color, #2196f3)",dry:"var(--state-climate-dry-color, #00bcd4)",fan_only:"var(--state-climate-fan_only-color, #00acc1)",off:"var(--state-climate-off-color, #8a8a8a)"},Nt={heating:"heat",preheating:"heat",cooling:"cool",drying:"dry",fan:"fan_only",defrosting:"cool"},Pt={modes:!0,fan:!0,swing:!0,presets:!0,humidity:!0,sensors:!0,graph:!1,shortcuts:!0},Mt=["modes","fan","shortcuts"],Ht=["switch","button"];const Ot={de:{card:{current:"Aktuell",target:"Ziel",humidity:"Luftfeuchte",target_humidity:"Ziel-Luftfeuchte",outdoor:"Außen",power:"Leistung",energy:"Energie",fan:"Lüfter",swing:"Lamellen",swing_horizontal:"Lamellen horizontal",preset:"Voreinstellung",mode:"Modus",history:"Verlauf",window_open:"Fenster offen",window_open_hint:"Ein Fenster ist geöffnet – Klimaanlage ggf. ausschalten.",unavailable:"Nicht verfügbar",entity_not_found:"Entität nicht gefunden",more:"Mehr",less:"Weniger",turn_on:"Einschalten",turn_off:"Ausschalten",no_history:"Keine Verlaufsdaten",shortcuts:"Schalter"},hvac_mode:{off:"Aus",heat:"Heizen",cool:"Kühlen",heat_cool:"Heizen/Kühlen",auto:"Automatisch",dry:"Entfeuchten",fan_only:"Nur Lüfter"},hvac_action:{off:"Aus",heating:"Heizt",cooling:"Kühlt",drying:"Entfeuchtet",idle:"Leerlauf",fan:"Lüftet",preheating:"Vorheizen",defrosting:"Abtauen"},editor:{entity:"Klima-Entität",name:"Name",icon:"Symbol",layout:"Layout",layout_full:"Voll (Drehregler)",layout_compact:"Kompakt (Kachel)",sections:"Sichtbare Bereiche",show_modes:"Betriebsmodi",show_fan:"Lüfterstufen",show_swing:"Lamellen",show_presets:"Voreinstellungen",show_humidity:"Ziel-Luftfeuchte",show_sensors:"Sensoren",show_graph:"Verlaufsgraph",sensors:"Zusätzliche Sensoren",temperature_sensor:"Raumtemperatur-Sensor",humidity_sensor:"Raumluftfeuchte-Sensor",outdoor_sensor:"Außentemperatur-Sensor",power_sensor:"Leistungssensor",energy_sensor:"Energiesensor",window_sensor:"Fenster-/Türkontakt",use_sensor_for_current:"Raumsensor als Ist-Temperatur verwenden",graph_hours:"Zeitraum Graph (Stunden)",show_shortcuts:"Schalter-Buttons",shortcuts_section:"Schalter-Buttons",shortcuts:"Entitäten (Schalter, Skripte, Szenen, Buttons)",auto_shortcuts:"Schalter des Geräts automatisch übernehmen",appearance:"Darstellung",expandable:"Details ausklappbar (volles Layout)",start_expanded:"Anfangs ausgeklappt",dropdown_threshold:"Dropdown ab so vielen Optionen (0 = immer Chips)"}},en:{card:{current:"Current",target:"Target",humidity:"Humidity",target_humidity:"Target humidity",outdoor:"Outdoor",power:"Power",energy:"Energy",fan:"Fan",swing:"Swing",swing_horizontal:"Horizontal swing",preset:"Preset",mode:"Mode",history:"History",window_open:"Window open",window_open_hint:"A window is open – consider turning off the air conditioner.",unavailable:"Unavailable",entity_not_found:"Entity not found",more:"More",less:"Less",turn_on:"Turn on",turn_off:"Turn off",no_history:"No history data",shortcuts:"Shortcuts"},hvac_mode:{off:"Off",heat:"Heat",cool:"Cool",heat_cool:"Heat/Cool",auto:"Auto",dry:"Dry",fan_only:"Fan only"},hvac_action:{off:"Off",heating:"Heating",cooling:"Cooling",drying:"Drying",idle:"Idle",fan:"Fan",preheating:"Preheating",defrosting:"Defrosting"},editor:{entity:"Climate entity",name:"Name",icon:"Icon",layout:"Layout",layout_full:"Full (dial)",layout_compact:"Compact (tile)",sections:"Visible sections",show_modes:"HVAC modes",show_fan:"Fan modes",show_swing:"Swing modes",show_presets:"Presets",show_humidity:"Target humidity",show_sensors:"Sensors",show_graph:"History graph",sensors:"Additional sensors",temperature_sensor:"Room temperature sensor",humidity_sensor:"Room humidity sensor",outdoor_sensor:"Outdoor temperature sensor",power_sensor:"Power sensor",energy_sensor:"Energy sensor",window_sensor:"Window / door contact",use_sensor_for_current:"Use room sensor as current temperature",graph_hours:"Graph period (hours)",show_shortcuts:"Shortcut buttons",shortcuts_section:"Shortcut buttons",shortcuts:"Entities (switches, scripts, scenes, buttons)",auto_shortcuts:"Automatically add the device's switches",appearance:"Appearance",expandable:"Collapsible details (full layout)",start_expanded:"Start expanded",dropdown_threshold:"Dropdown from this many options (0 = always chips)"}}},zt=(t,e)=>{let i=Ot[t];for(const t of e.split(".")){if(null==i||"object"!=typeof i)return;i=i[t]}return"string"==typeof i?i:void 0},Ut=t=>{const e=(t?.locale?.language??t?.language??navigator.language??"en").split("-")[0].toLowerCase();return e in Ot?e:"en"},Dt=(t,e)=>zt(Ut(t),e)??zt("en",e)??e,jt=t=>t.replace(/_/g," ").replace(/^\w/,t=>t.toUpperCase()),Rt=(t,e,i,s)=>{if(t.formatEntityAttributeValue){const o=t.formatEntityAttributeValue(e,i,s);if(o&&o!==s)return o}return"hvac_action"===i?zt(Ut(t),`hvac_action.${s}`)??jt(s):jt(s)},It=(t,e,i)=>{if(t.formatEntityState){const s=t.formatEntityState(e,i);if(s&&s!==i)return s}return zt(Ut(t),`hvac_mode.${i}`)??jt(i)},Lt=r`
  :host { display: block; }
  ha-card {
    position: relative; overflow: hidden; padding: 16px; box-sizing: border-box; height: 100%;
    display: flex; flex-direction: column; gap: 14px;
    transition: background 0.4s;
  }
  .glow {
    position: absolute; inset: -40% -20% auto -20%; height: 70%; pointer-events: none;
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
`,Ft=135,Bt=270,Wt=(t,e=82)=>{const i=t*Math.PI/180;return{x:100+e*Math.cos(i),y:100+e*Math.sin(i)}},Vt=(t,e,i=82)=>{if(e-t<.01)return"";const s=Wt(t,i),o=Wt(e,i),n=e-t>180?1:0;return`M ${s.x} ${s.y} A ${i} ${i} 0 ${n} 1 ${o.x} ${o.y}`};let Kt=class extends ct{constructor(){super(...arguments),this.min=16,this.max=30,this.step=.5,this.dual=!1,this.disabled=!1,this.color="var(--primary-color)",this.lowColor="var(--state-climate-heat-color, #ff6d00)",this.highColor="var(--state-climate-cool-color, #2196f3)",this.active=!1}_clamp(t){const e=Math.round((t-this.min)/this.step)*this.step+this.min,i=Number(e.toFixed(this.step<1?1:0));return Math.min(this.max,Math.max(this.min,i))}_toAngle(t){const e=this.max-this.min||1,i=Math.min(1,Math.max(0,(t-this.min)/e));return Ft+Bt*i}_fromPointer(t){const e=this.shadowRoot.querySelector("svg").getBoundingClientRect(),i=(t.clientX-e.left)/e.width*200-100,s=(t.clientY-e.top)/e.height*200-100;let o=(180*Math.atan2(s,i)/Math.PI-Ft+720)%360;return o>Bt&&(o=o>315?0:Bt),this._clamp(this.min+o/Bt*(this.max-this.min))}_pickHandle(t){if(!this.dual)return"value";const e=this.low??this.min,i=this.high??this.max;return t<=e?"low":t>=i?"high":t-e<i-t?"low":"high"}_apply(t,e){"value"===t?this.value=e:"low"===t?this.low=Math.min(e,this.high??this.max):this.high=Math.max(e,this.low??this.min)}_emit(t){const e=this.dual?{low:this.low,high:this.high}:{value:this.value};this.dispatchEvent(new CustomEvent(t,{detail:e,bubbles:!0,composed:!0}))}_onPointerDown(t){if(this.disabled)return;t.preventDefault();const e=this._fromPointer(t);this._dragging=this._pickHandle(e),t.currentTarget.setPointerCapture(t.pointerId),this._apply(this._dragging,e),this._emit("value-changing")}_onPointerMove(t){this._dragging&&(this._apply(this._dragging,this._fromPointer(t)),this._emit("value-changing"))}_onPointerUp(t){this._dragging&&(t.currentTarget.releasePointerCapture?.(t.pointerId),this._dragging=void 0,this._emit("value-changed"))}_onKey(t,e){if(this.disabled)return;const i={ArrowUp:this.step,ArrowRight:this.step,ArrowDown:-this.step,ArrowLeft:-this.step,PageUp:5*this.step,PageDown:5*-this.step};if(!(e.key in i))return;e.preventDefault();const s="value"===t?this.value:"low"===t?this.low:this.high;this._apply(t,this._clamp((s??this.min)+i[e.key])),this._emit("value-changed")}_handle(t,e,i){if(null==e)return q;const s=Wt(this._toAngle(e));return V`
      <g class="handle ${this._dragging===t?"dragging":""}" tabindex=${this.disabled?-1:0}
        role="slider" aria-valuemin=${this.min} aria-valuemax=${this.max} aria-valuenow=${e}
        aria-label=${t} @keydown=${e=>this._onKey(t,e)}>
        <circle cx=${s.x} cy=${s.y} r="13" class="halo" style="fill:${i}"></circle>
        <circle cx=${s.x} cy=${s.y} r="9" class="knob" style="stroke:${i}"></circle>
      </g>`}render(){let t=q;this.disabled||(this.dual&&null!=this.low&&null!=this.high?t=V`<path class="active" d=${Vt(this._toAngle(this.low),this._toAngle(this.high))}
          style="stroke:url(#rangeGrad)"></path>`:null!=this.value&&(t=V`<path class="active" d=${Vt(Ft,this._toAngle(this.value))}
          style="stroke:${this.color}"></path>`));const e=null!=this.current&&this.current>=this.min&&this.current<=this.max?Wt(this._toAngle(this.current),82):void 0,i=Array.from({length:55},(t,e)=>Ft+5*e);return W`
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
          ${i.map(t=>{const e=Wt(t,98),i=Wt(t,93);return V`<line class="tick" x1=${e.x} y1=${e.y} x2=${i.x} y2=${i.y}></line>`})}
          <path class="track" d=${Vt(Ft,405)}></path>
          ${t}
          ${e?V`<circle class="current" cx=${e.x} cy=${e.y} r="3.5"></circle>`:q}
          ${this.disabled?q:this.dual?[this._handle("low",this.low,this.lowColor),this._handle("high",this.high,this.highColor)]:this._handle("value",this.value,this.color)}
        </svg>
        <div class="center"><slot></slot></div>
      </div>
    `}};Kt.styles=r`
    :host { display: block; width: 100%; max-width: 320px; margin: 0 auto; }
    .dial { position: relative; width: 100%; aspect-ratio: 1; }
    svg { width: 100%; height: 100%; touch-action: none; user-select: none; overflow: visible; }
    .track { fill: none; stroke: var(--divider-color, rgba(127,127,127,0.25)); stroke-width: 14; stroke-linecap: round; }
    .active { fill: none; stroke-width: 14; stroke-linecap: round; transition: stroke 0.4s; }
    .tick { stroke: var(--secondary-text-color); stroke-opacity: 0.25; stroke-width: 1.2; stroke-linecap: round; }
    .is-active .tick { stroke: var(--dial-color); stroke-opacity: 0.45; animation: pulse 2.4s ease-in-out infinite; }
    .current { fill: var(--primary-text-color); stroke: var(--card-background-color, #fff); stroke-width: 1.5; }
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
    @keyframes pulse { 0%, 100% { stroke-opacity: 0.2; } 50% { stroke-opacity: 0.6; } }
    @media (prefers-reduced-motion: reduce) { .is-active .tick { animation: none; } }
  `,t([mt({type:Number})],Kt.prototype,"min",void 0),t([mt({type:Number})],Kt.prototype,"max",void 0),t([mt({type:Number})],Kt.prototype,"step",void 0),t([mt({type:Number})],Kt.prototype,"value",void 0),t([mt({type:Number})],Kt.prototype,"low",void 0),t([mt({type:Number})],Kt.prototype,"high",void 0),t([mt({type:Number})],Kt.prototype,"current",void 0),t([mt({type:Boolean})],Kt.prototype,"dual",void 0),t([mt({type:Boolean})],Kt.prototype,"disabled",void 0),t([mt()],Kt.prototype,"color",void 0),t([mt()],Kt.prototype,"lowColor",void 0),t([mt()],Kt.prototype,"highColor",void 0),t([mt({type:Boolean})],Kt.prototype,"active",void 0),t([_t()],Kt.prototype,"_dragging",void 0),Kt=t([dt("hcc-climate-dial")],Kt);let qt=class extends ct{constructor(){super(...arguments),this.modes=[],this.disabled=!1}_select(t){this.disabled||t===this.selected||this.dispatchEvent(new CustomEvent("mode-selected",{detail:{mode:t},bubbles:!0,composed:!0}))}render(){return W`<div class="bar" role="radiogroup">
      ${this.modes.map(t=>W`
        <button class="mode ${t.value===this.selected?"on":""}" role="radio"
          aria-checked=${t.value===this.selected} title=${t.label} aria-label=${t.label}
          ?disabled=${this.disabled} style="--mode-color:${Tt[t.value]??"var(--primary-color)"}"
          @click=${()=>this._select(t.value)}>
          <ha-icon .icon=${Et[t.value]??"mdi:thermostat"}></ha-icon>
        </button>`)}
    </div>`}};qt.styles=r`
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
  `,t([mt({attribute:!1})],qt.prototype,"modes",void 0),t([mt()],qt.prototype,"selected",void 0),t([mt({type:Boolean})],qt.prototype,"disabled",void 0),qt=t([dt("hcc-mode-bar")],qt);let Gt=class extends ct{constructor(){super(...arguments),this.label="",this.options=[],this.disabled=!1,this.dropdownThreshold=6}_select(t){this.disabled||t===this.selected||this.dispatchEvent(new CustomEvent("option-selected",{detail:{value:t},bubbles:!0,composed:!0}))}get _useDropdown(){return this.dropdownThreshold>0&&this.options.length>this.dropdownThreshold}_renderDropdown(){return W`<div class="dropdown-row">
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
      </div>`}};Gt.styles=r`
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
  `,t([mt()],Gt.prototype,"label",void 0),t([mt()],Gt.prototype,"icon",void 0),t([mt()],Gt.prototype,"selected",void 0),t([mt({attribute:!1})],Gt.prototype,"options",void 0),t([mt({type:Boolean})],Gt.prototype,"disabled",void 0),t([mt({type:Number})],Gt.prototype,"dropdownThreshold",void 0),Gt=t([dt("hcc-attribute-select")],Gt);let Zt=class extends ct{constructor(){super(...arguments),this.items=[]}_open(t){t&&this.dispatchEvent(new CustomEvent("hass-more-info",{detail:{entityId:t},bubbles:!0,composed:!0}))}render(){return W`<div class="row">
      ${this.items.map(t=>W`
        <button class="item ${t.warning?"warn":""}" title=${t.label} @click=${()=>this._open(t.entity)}>
          <ha-icon .icon=${t.icon}></ha-icon>
          <div class="text"><span class="value">${t.value}</span><span class="label">${t.label}</span></div>
        </button>`)}
    </div>`}};Zt.styles=r`
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
  `,t([mt({attribute:!1})],Zt.prototype,"items",void 0),Zt=t([dt("hcc-sensor-row")],Zt);let Jt=class extends ct{constructor(){super(...arguments),this.hours=24,this.emptyText="",this.unit="",this._current=[],this._target=[],this._bands=[],this._loaded=!1,this._key=""}connectedCallback(){super.connectedCallback(),this._timer=window.setInterval(()=>this._fetch(),3e5)}disconnectedCallback(){super.disconnectedCallback(),clearInterval(this._timer)}updated(t){const e=`${this.entity}|${this.sensor}|${this.hours}`;this.hass&&e!==this._key&&(this._key=e,this._fetch()),super.updated(t)}async _fetch(){if(!this.hass||!this.entity)return;const t=new Date,e=new Date(t.getTime()-3600*this.hours*1e3),i=[this.entity,...this.sensor?[this.sensor]:[]];try{const s=await this.hass.callWS({type:"history/history_during_period",start_time:e.toISOString(),end_time:t.toISOString(),entity_ids:i,minimal_response:!1,no_attributes:!1,significant_changes_only:!1});this._parse(s,e.getTime(),t.getTime())}catch(t){console.warn("ha-climate-card: history fetch failed",t)}this._loaded=!0}_parse(t,e,i){const s=t[this.entity]??[],o=[],n=[],r=[];let a={};if(s.forEach((t,l)=>{t.a&&(a=t.a);const c=Math.max(1e3*t.lu,e),h=Number(a.current_temperature),d=Number(a.temperature??a.target_temp_high);!this.sensor&&Number.isFinite(h)&&o.push({t:c,v:h}),Number.isFinite(d)&&"off"!==t.s?n.push({t:c,v:d}):n.push({t:c,v:NaN});const p=Nt[a.hvac_action];if(p&&"off"!==t.s){const t=s[l+1]?1e3*s[l+1].lu:i;r.push({from:c,to:t,color:Tt[p]})}}),this.sensor)for(const i of t[this.sensor]??[]){const t=Number(i.s);Number.isFinite(t)&&o.push({t:Math.max(1e3*i.lu,e),v:t})}o.length&&o.push({t:i,v:o[o.length-1].v}),n.length&&n.push({t:i,v:n[n.length-1].v}),this._current=o,this._target=n,this._bands=r}_path(t,e,i,s){let o,n="";for(const r of t)Number.isFinite(r.v)?(n+=o?s?`H ${e(r.t).toFixed(1)} V ${i(r.v).toFixed(1)} `:`L ${e(r.t).toFixed(1)} ${i(r.v).toFixed(1)} `:`M ${e(r.t).toFixed(1)} ${i(r.v).toFixed(1)} `,o=r):o=void 0;return n}render(){if(!this._loaded)return W`<div class="placeholder"></div>`;const t=[...this._current,...this._target].map(t=>t.v).filter(Number.isFinite);if(!t.length)return W`<div class="placeholder empty">${this.emptyText}</div>`;const e=Date.now(),i=e-3600*this.hours*1e3;let s=Math.min(...t),o=Math.max(...t);const n=s,r=o;if(o-s<2){const t=(o+s)/2;s=t-1,o=t+1}const a=.15*(o-s);s-=a,o+=a;const l=t=>(t-i)/(e-i)*300,c=t=>80-(t-s)/(o-s)*80,h=this._current[this._current.length-1];return W`
      <div class="graph">
        <svg viewBox="0 0 ${300} ${80}" preserveAspectRatio="none">
          ${this._bands.map(t=>V`<rect x=${l(t.from)} y="0" width=${Math.max(.5,l(t.to)-l(t.from))}
            height=${80} style="fill:${t.color}" class="band"></rect>`)}
          <path class="target" d=${this._path(this._target,l,c,!0)}></path>
          <path class="current" d=${this._path(this._current,l,c,!1)}></path>
        </svg>
        <div class="labels">
          <span>-${this.hours}h</span>
          <span>${n.toFixed(1)}–${r.toFixed(1)}${this.unit}</span>
          ${h?W`<span>${h.v.toFixed(1)}${this.unit}</span>`:q}
        </div>
      </div>`}};Jt.styles=r`
    :host { display: block; }
    .graph svg { width: 100%; height: 80px; display: block; overflow: visible; }
    .band { opacity: 0.14; }
    .current { fill: none; stroke: var(--hcc-accent, var(--primary-color)); stroke-width: 2; vector-effect: non-scaling-stroke; stroke-linejoin: round; }
    .target { fill: none; stroke: var(--secondary-text-color); stroke-width: 1.5; stroke-dasharray: 4 3; vector-effect: non-scaling-stroke; opacity: 0.7; }
    .labels { display: flex; justify-content: space-between; font-size: 11px; color: var(--secondary-text-color); margin-top: 4px; }
    .placeholder { height: 80px; border-radius: 12px; background: rgba(127,127,127,0.08); }
    .placeholder.empty { display: flex; align-items: center; justify-content: center; font-size: 12px; color: var(--secondary-text-color); }
  `,t([mt({attribute:!1})],Jt.prototype,"hass",void 0),t([mt()],Jt.prototype,"entity",void 0),t([mt()],Jt.prototype,"sensor",void 0),t([mt({type:Number})],Jt.prototype,"hours",void 0),t([mt()],Jt.prototype,"emptyText",void 0),t([mt()],Jt.prototype,"unit",void 0),t([_t()],Jt.prototype,"_current",void 0),t([_t()],Jt.prototype,"_target",void 0),t([_t()],Jt.prototype,"_bands",void 0),t([_t()],Jt.prototype,"_loaded",void 0),Jt=t([dt("hcc-history-graph")],Jt);const Xt=["switch","input_boolean","light","fan","automation","siren","humidifier"],Yt={switch:"mdi:toggle-switch-variant",input_boolean:"mdi:toggle-switch-variant",light:"mdi:lightbulb",fan:"mdi:fan",script:"mdi:script-text-play",scene:"mdi:palette",button:"mdi:gesture-tap-button",input_button:"mdi:gesture-tap-button",automation:"mdi:robot"},Qt=[[/licht|light|panel|display|led/i,"mdi:lightbulb-outline"],[/leise|quiet|silent/i,"mdi:volume-off"],[/frisch|fresh|air/i,"mdi:air-filter"],[/xfan|x-fan|zusatz|dry/i,"mdi:fan-plus"],[/health|ion|plasma/i,"mdi:shimmer"],[/turbo|boost|power/i,"mdi:rocket-launch-outline"],[/sleep|schlaf/i,"mdi:sleep"],[/timer/i,"mdi:timer-outline"]];let te=class extends ct{constructor(){super(...arguments),this.items=[]}_activate(t){if(!this.hass)return;const e=t.entity.split(".")[0],i={entity_id:t.entity};Xt.includes(e)?this.hass.callService("homeassistant","toggle",i):"button"===e||"input_button"===e?this.hass.callService(e,"press",i):"script"===e||"scene"===e?this.hass.callService(e,"turn_on",i):this.hass.callService("homeassistant","toggle",i)}_moreInfo(t,e){t.preventDefault(),this.dispatchEvent(new CustomEvent("hass-more-info",{detail:{entityId:e},bubbles:!0,composed:!0}))}_icon(t,e){return!t.icon&&e&&customElements.get("ha-state-icon")?W`<ha-state-icon .hass=${this.hass} .stateObj=${e}></ha-state-icon>`:W`<ha-icon .icon=${t.icon??((t,e,i)=>{if(t?.attributes.icon)return t.attributes.icon;const s=Qt.find(([t])=>t.test(e)||t.test(i));return s?.[1]??Yt[e.split(".")[0]]??"mdi:gesture-tap"})(e,t.entity,t.name)}></ha-icon>`}render(){if(!this.hass||!this.items.length)return q;const t=this.hass.locale?.language??this.hass.language;return W`<div class="row" lang=${t}>
      ${this.items.map(t=>{const e=this.hass.states[t.entity],i="on"===e?.state,s=!e||"unavailable"===e.state;return W`<button class="sc ${i?"on":""}" ?disabled=${s} title=${t.name}
          aria-pressed=${Xt.includes(t.entity.split(".")[0])?String(i):q}
          @click=${()=>this._activate(t)} @contextmenu=${e=>this._moreInfo(e,t.entity)}>
          ${this._icon(t,e)}
          <span>${t.name}</span>
        </button>`})}
    </div>`}};te.styles=r`
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
  `,t([mt({attribute:!1})],te.prototype,"hass",void 0),t([mt({attribute:!1})],te.prototype,"items",void 0),te=t([dt("hcc-shortcut-row")],te);const ee=(t,e)=>({name:t,selector:{entity:{filter:e}}});let ie=class extends ct{constructor(){super(...arguments),this._computeLabel=t=>t.name in Pt?this._t(`show_${t.name}`):this._t(t.name)}setConfig(t){this._config=t}_t(t){return Dt(this.hass,`editor.${t}`)}_schema(){return[{name:"entity",required:!0,selector:{entity:{domain:"climate"}}},{type:"grid",name:"",schema:[{name:"name",selector:{text:{}}},{name:"icon",selector:{icon:{}}}]},{name:"layout",selector:{select:{mode:"box",options:[{value:"full",label:this._t("layout_full")},{value:"compact",label:this._t("layout_compact")}]}}},{type:"expandable",name:"show",title:this._t("sections"),icon:"mdi:eye-outline",schema:[{type:"grid",name:"",schema:Object.keys(Pt).map(t=>({name:t,selector:{boolean:{}}}))}]},{type:"expandable",name:"",flatten:!0,title:this._t("sensors"),icon:"mdi:thermometer-lines",schema:[ee("temperature_sensor",{domain:"sensor",device_class:"temperature"}),{name:"use_sensor_for_current",selector:{boolean:{}}},ee("humidity_sensor",{domain:"sensor",device_class:"humidity"}),ee("outdoor_sensor",{domain:["sensor","weather"]}),ee("power_sensor",{domain:"sensor",device_class:"power"}),ee("energy_sensor",{domain:"sensor",device_class:"energy"}),ee("window_sensor",{domain:"binary_sensor"})]},{type:"expandable",name:"",flatten:!0,title:this._t("shortcuts_section"),icon:"mdi:gesture-tap-button",schema:[{name:"auto_shortcuts",selector:{boolean:{}}},{name:"shortcuts",selector:{entity:{multiple:!0,filter:{domain:["switch","input_boolean","light","fan","script","scene","button","input_button","automation"]}}}}]},{type:"expandable",name:"",flatten:!0,title:this._t("appearance"),icon:"mdi:palette-outline",schema:[{name:"expandable",selector:{boolean:{}}},{name:"start_expanded",selector:{boolean:{}}},{name:"dropdown_threshold",selector:{number:{min:0,max:20,step:1,mode:"box"}}},{name:"graph_hours",selector:{number:{min:1,max:168,step:1,mode:"box",unit_of_measurement:"h"}}}]}]}_valueChanged(t){const e={...t.detail.value};if(Array.isArray(e.shortcuts)){const t=this._config?.shortcuts??[];e.shortcuts=e.shortcuts.map(e=>{const i="string"==typeof e?e:e.entity;return t.find(t=>"string"!=typeof t&&t.entity===i)??i})}for(const t of Object.keys(e)){const i=e[t];(""===i||null==i||Array.isArray(i)&&!i.length)&&delete e[t]}this._config=e,this.dispatchEvent(new CustomEvent("config-changed",{detail:{config:e},bubbles:!0,composed:!0}))}render(){if(!this.hass||!this._config)return q;const t={layout:"full",graph_hours:24,auto_shortcuts:!0,expandable:!0,dropdown_threshold:6,...this._config,shortcuts:this._config.shortcuts?.map(t=>"string"==typeof t?t:t.entity),show:{...Pt,...this._config.show??{}}};return W`<ha-form .hass=${this.hass} .data=${t} .schema=${this._schema()}
      .computeLabel=${this._computeLabel} @value-changed=${this._valueChanged}></ha-form>`}};ie.styles=r`:host { display: block; }`,t([mt({attribute:!1})],ie.prototype,"hass",void 0),t([_t()],ie.prototype,"_config",void 0),ie=t([dt("ha-climate-card-editor")],ie);const se=["unavailable","unknown"];console.info("%c HA-CLIMATE-CARD %c v1.0.0 ","color:#fff;background:#2196f3;font-weight:700;border-radius:4px 0 0 4px","color:#2196f3;background:#fff;font-weight:700;border-radius:0 4px 4px 0"),window.customCards=window.customCards||[],window.customCards.push({type:"ha-climate-card",name:"HA Climate Card",description:"Moderne Karte für Klimaanlagen mit Drehregler, allen Modi, Sensoren und Verlauf.",preview:!0,documentationURL:"https://github.com/passi277/HA_Climate_Card"});let oe=class extends ct{constructor(){super(...arguments),this._expanded=!1}static getConfigElement(){return document.createElement("ha-climate-card-editor")}static getStubConfig(t){return{entity:Object.keys(t.states).find(t=>t.startsWith("climate."))??"",layout:"full"}}setConfig(t){if(!t?.entity||!t.entity.startsWith("climate."))throw new Error("ha-climate-card: 'entity' muss eine climate-Entität sein (climate.xyz)");const e=this._config?.start_expanded!==t.start_expanded;this._config={layout:"full",graph_hours:24,...t},e&&(this._expanded=!!t.start_expanded)}getCardSize(){return"compact"===this._config?.layout?this._expanded?6:2:!1===this._config?.expandable||this._expanded?this._show.graph?10:8:6}getGridOptions(){return{columns:6,min_columns:4,rows:"auto"}}get _show(){return{...Pt,...this._config?.show??{}}}get _stateObj(){return this._config&&this.hass?.states[this._config.entity]}shouldUpdate(t){if(!t.has("hass")||t.size>1)return!0;const e=t.get("hass");if(!e||!this._config)return!0;return[this._config.entity,this._config.temperature_sensor,this._config.humidity_sensor,this._config.outdoor_sensor,this._config.power_sensor,this._config.energy_sensor,this._config.window_sensor,...this._shortcutIds()].filter(Boolean).some(t=>e.states[t]!==this.hass.states[t])||e.locale!==this.hass.locale}updated(t){super.updated(t);const e=this._stateObj;e&&this._sentAt&&e.last_updated!==this._sentAt&&(this._sentAt=void 0,this._pending=void 0,this._pendingHumidity=void 0)}disconnectedCallback(){super.disconnectedCallback(),clearTimeout(this._tempTimer),clearTimeout(this._humTimer),clearTimeout(this._clearTimer)}_t(t){return Dt(this.hass,t)}get _unit(){return this.hass?.config?.unit_system?.temperature??"°C"}_step(t){return Number(t.attributes.target_temp_step)||("°F"===this._unit?1:.5)}_fmt(t,e=.5){return null!=t&&Number.isFinite(Number(t))?Number(t).toFixed(e<1?1:0):"–"}_isDual(t){const e=t.attributes;return kt(e,gt)&&null!=e.target_temp_low&&null!=e.target_temp_high&&(null==e.temperature||!kt(e,ft))}_modeColor(t){if("off"===t.state||se.includes(t.state))return Tt.off;const e=Nt[t.attributes.hvac_action];return Tt[e??t.state]??"var(--primary-color)"}_isActive(t){const e=t.attributes.hvac_action;return!!e&&!["idle","off"].includes(e)&&"off"!==t.state}_currentTemp(t){const e=this._config?.temperature_sensor;if(e&&this._config?.use_sensor_for_current){const t=Number(this.hass?.states[e]?.state);if(Number.isFinite(t))return t}const i=t.attributes.current_temperature;return null==i?void 0:Number(i)}_targets(t){const e=t.attributes;return{value:this._pending?.value??(null!=e.temperature?Number(e.temperature):void 0),low:this._pending?.low??(null!=e.target_temp_low?Number(e.target_temp_low):void 0),high:this._pending?.high??(null!=e.target_temp_high?Number(e.target_temp_high):void 0)}}_sensorState(t){if(!t||!this.hass)return;const e=this.hass.states[t];if(!e)return;if(se.includes(e.state))return"–";if(this.hass.formatEntityState)return this.hass.formatEntityState(e);const i=e.attributes.unit_of_measurement;return i?`${e.state} ${i}`:e.state}_windowOpen(){const t=this._config?.window_sensor;return!!t&&"on"===this.hass?.states[t]?.state}_autoShortcutIds(){const t=this.hass,e=this._config?.entity;if(!t?.entities||!e)return[];const i=this._autoShortcutCache;if(i&&i.key===t.entities&&i.device===e)return i.ids;const s=t.entities[e]?.device_id,o=s?Object.values(t.entities).filter(t=>t.device_id===s&&t.entity_id!==e&&!t.hidden&&Ht.includes(t.entity_id.split(".")[0])).map(t=>t.entity_id).sort():[];return this._autoShortcutCache={key:t.entities,device:e,ids:o},o}_shortcutIds(){const t=this._config;return t?t.shortcuts?t.shortcuts.map(t=>"string"==typeof t?t:t.entity):!1===t.auto_shortcuts?[]:this._autoShortcutIds():[]}_shortName(t,e){const i=this.hass.states[t]?.attributes.friendly_name??t.split(".")[1],s=this.hass.entities?.[t]?.device_id,o=s?this.hass.devices?.[s]:void 0,n=[o?.name_by_user,o?.name,e.attributes.friendly_name,this._config?.name].filter(t=>!!t).sort((t,e)=>e.length-t.length);for(const t of n)if(i.toLowerCase().startsWith(t.toLowerCase()+" "))return i.slice(t.length+1);return i}_shortcutItems(t){const e=this._config;return(e.shortcuts??(!1===e.auto_shortcuts?[]:this._autoShortcutIds())).map(t=>"string"==typeof t?{entity:t}:t).filter(t=>t?.entity&&this.hass.states[t.entity]).map(e=>({entity:e.entity,name:e.name??this._shortName(e.entity,t),icon:e.icon}))}_call(t,e={}){const i=this._stateObj;i&&this.hass&&(this._sentAt=i.last_updated,this.hass.callService("climate",t,{entity_id:i.entity_id,...e}).catch(t=>{console.error("ha-climate-card:",t),this._pending=void 0,this._pendingHumidity=void 0}),clearTimeout(this._clearTimer),this._clearTimer=window.setTimeout(()=>{this._pending=void 0,this._pendingHumidity=void 0,this._sentAt=void 0},6e3))}_scheduleTemp(t){clearTimeout(this._tempTimer),this._tempTimer=window.setTimeout(()=>{const t=this._stateObj,e=this._pending;t&&e&&(this._isDual(t)?this._call("set_temperature",{target_temp_low:e.low,target_temp_high:e.high}):null!=e.value&&this._call("set_temperature",{temperature:e.value}))},t)}_onDialChanging(t){clearTimeout(this._tempTimer),this._pending={...t.detail}}_onDialChanged(t){this._pending={...t.detail},this._scheduleTemp(400)}_stepTarget(t,e){const i=this._stateObj;if(!i)return;const s=this._step(i),o=Number(i.attributes.min_temp??7),n=Number(i.attributes.max_temp??35),r=this._targets(i),a=r[t]??this._currentTemp(i)??o;let l=Math.min(n,Math.max(o,Math.round((a+e*s)/s)*s));l=Number(l.toFixed(s<1?1:0)),"low"===t&&null!=r.high&&(l=Math.min(l,r.high)),"high"===t&&null!=r.low&&(l=Math.max(l,r.low)),this._pending={...r,[t]:l},this._scheduleTemp(1e3)}_stepHumidity(t){const e=this._stateObj;if(!e)return;const i=Number(e.attributes.min_humidity??30),s=Number(e.attributes.max_humidity??99),o=this._pendingHumidity??Number(e.attributes.humidity??50);this._pendingHumidity=Math.min(s,Math.max(i,o+t)),clearTimeout(this._humTimer),this._humTimer=window.setTimeout(()=>this._call("set_humidity",{humidity:this._pendingHumidity}),1e3)}_setMode(t){this._call("set_hvac_mode",{hvac_mode:t.detail.mode})}_togglePower(){const t=this._stateObj;if(!t)return;const e=t.attributes;if("off"===t.state)if(kt(e,xt))this._call("turn_on");else{const t=e.hvac_modes?.find(t=>"off"!==t);t&&this._call("set_hvac_mode",{hvac_mode:t})}else kt(e,$t)?this._call("turn_off"):this._call("set_hvac_mode",{hvac_mode:"off"})}_moreInfo(t){this.dispatchEvent(new CustomEvent("hass-more-info",{detail:{entityId:t??this._config?.entity},bubbles:!0,composed:!0}))}_renderHeader(t,e,i){const s=t.attributes.hvac_action,o=s?Rt(this.hass,t,"hvac_action",s):It(this.hass,t,t.state),n=t.attributes.preset_mode&&"none"!==t.attributes.preset_mode?` · ${Rt(this.hass,t,"preset_mode",t.attributes.preset_mode)}`:"",r=(t.attributes.hvac_modes??[]).includes("off")||kt(t.attributes,$t);return W`
      <div class="header">
        <button class="title" @click=${()=>this._moreInfo()}>
          <span class="icon-badge ${this._isActive(t)?"active":""}" style="--accent:${i}">
            <ha-icon .icon=${this._config.icon??Ct[s??""]??Et[t.state]??"mdi:air-conditioner"}></ha-icon>
          </span>
          <span class="names">
            <span class="name">${e}</span>
            <span class="status">${o}${n}</span>
          </span>
        </button>
        ${r?W`
          <button class="power ${"off"!==t.state?"on":""}" style="--accent:${i}"
            title=${this._t("off"===t.state?"card.turn_on":"card.turn_off")}
            aria-label=${this._t("off"===t.state?"card.turn_on":"card.turn_off")}
            @click=${this._togglePower}>
            <ha-icon icon="mdi:power"></ha-icon>
          </button>`:q}
      </div>`}_renderWindowWarning(){return this._windowOpen()?W`<div class="banner" @click=${()=>this._moreInfo(this._config.window_sensor)}>
      <ha-icon icon="mdi:window-open-variant"></ha-icon>
      <div><strong>${this._t("card.window_open")}</strong><span>${this._t("card.window_open_hint")}</span></div>
    </div>`:q}_renderStepper(t,e,i,s){return W`<div class="stepper" style=${s?`--accent:${s}`:""}>
      <button aria-label="-" @click=${()=>this._stepTarget(t,-1)}><ha-icon icon="mdi:minus"></ha-icon></button>
      <span class="stepper-value">${this._fmt(e,i)}<small>${this._unit}</small></span>
      <button aria-label="+" @click=${()=>this._stepTarget(t,1)}><ha-icon icon="mdi:plus"></ha-icon></button>
    </div>`}_renderDial(t,e){const i=t.attributes,s=this._step(t),o=this._isDual(t),n=this._targets(t),r=this._currentTemp(t),a="off"===t.state,l=o||null!=n.value&&kt(i,ft),c=this._config?.humidity_sensor?this.hass.states[this._config.humidity_sensor]?.state:i.current_humidity;return W`
      <hcc-climate-dial
        .min=${Number(i.min_temp??7)} .max=${Number(i.max_temp??35)} .step=${s}
        .value=${n.value} .low=${n.low} .high=${n.high} .current=${r}
        .dual=${o} .disabled=${a||!l} .color=${e} .active=${this._isActive(t)}
        @value-changing=${this._onDialChanging} @value-changed=${this._onDialChanged}>
        <div class="dial-center">
          <span class="dial-label">${a?It(this.hass,t,"off"):this._t("card.target")}</span>
          ${a||!l?W`<span class="dial-big">${this._fmt(r,s)}<sup>${this._unit}</sup></span>`:o?W`<span class="dial-range">
                  <span style="color:var(--state-climate-heat-color,#ff6d00)">${this._fmt(n.low,s)}</span>
                  <span class="sep">–</span>
                  <span style="color:var(--state-climate-cool-color,#2196f3)">${this._fmt(n.high,s)}</span>
                </span>`:W`<span class="dial-big">${this._fmt(n.value,s)}<sup>${this._unit}</sup></span>`}
          <span class="dial-sub">
            ${!a&&l?W`<ha-icon icon="mdi:home-thermometer-outline"></ha-icon>${this._fmt(r,s)}${this._unit}`:q}
            ${null!=c&&""!==c?W`<ha-icon icon="mdi:water-percent"></ha-icon>${Math.round(Number(c))}%`:q}
          </span>
        </div>
      </hcc-climate-dial>
      ${!a&&l?W`<div class="dial-steppers ${o?"dual":""}">
        ${o?W`${this._renderStepper("low",n.low,s,"var(--state-climate-heat-color,#ff6d00)")}
                 ${this._renderStepper("high",n.high,s,"var(--state-climate-cool-color,#2196f3)")}`:W`<button class="round" aria-label="-" @click=${()=>this._stepTarget("value",-1)}><ha-icon icon="mdi:minus"></ha-icon></button>
                 <button class="round" aria-label="+" @click=${()=>this._stepTarget("value",1)}><ha-icon icon="mdi:plus"></ha-icon></button>`}
      </div>`:q}`}_sections(t,e){const i=t.attributes,s=this._show,o=this.hass,n=[],r=(t,e)=>n.push({key:e,tpl:t}),a=(i.hvac_modes??[]).slice().sort((t,e)=>St.indexOf(t)-St.indexOf(e)).map(e=>({value:e,label:It(o,t,e)}));s.modes&&a.length>1&&r(W`<hcc-mode-bar .modes=${a} .selected=${t.state} @mode-selected=${this._setMode}></hcc-mode-bar>`,"modes");const l=(e,s,n,a,l,c,h,d)=>{const p=i[n];d&&kt(i,a)&&p?.length&&r(W`<hcc-attribute-select .label=${this._t(l)} .icon=${c} .selected=${i[s]}
        .options=${p.map(e=>({value:e,label:Rt(o,t,s,e)}))}
        .dropdownThreshold=${this._config.dropdown_threshold??6}
        @option-selected=${t=>this._call(h,{[s]:t.detail.value})}>
      </hcc-attribute-select>`,e)};if(l("fan","fan_mode","fan_modes",vt,"card.fan","mdi:fan","set_fan_mode",s.fan),l("swing","swing_mode","swing_modes",wt,"card.swing","mdi:arrow-oscillating","set_swing_mode",s.swing),l("swing","swing_horizontal_mode","swing_horizontal_modes",At,"card.swing_horizontal","mdi:arrow-left-right","set_swing_horizontal_mode",s.swing),l("presets","preset_mode","preset_modes",bt,"card.preset","mdi:star-outline","set_preset_mode",s.presets),s.shortcuts){const e=this._shortcutItems(t);e.length&&r(W`<hcc-shortcut-row .hass=${o} .items=${e}></hcc-shortcut-row>`,"shortcuts")}if(s.humidity&&kt(i,yt)&&null!=i.humidity){const t=this._pendingHumidity??Number(i.humidity);r(W`<div class="humidity-row">
        <span class="row-label"><ha-icon icon="mdi:water-percent"></ha-icon>${this._t("card.target_humidity")}</span>
        <div class="stepper">
          <button aria-label="-" @click=${()=>this._stepHumidity(-1)}><ha-icon icon="mdi:minus"></ha-icon></button>
          <span class="stepper-value">${t}<small>%</small></span>
          <button aria-label="+" @click=${()=>this._stepHumidity(1)}><ha-icon icon="mdi:plus"></ha-icon></button>
        </div>
      </div>`,"humidity")}if(s.sensors){const e=this._sensorItems(t);e.length&&r(W`<hcc-sensor-row .items=${e}></hcc-sensor-row>`,"sensors")}return s.graph&&r(W`<div class="graph-wrap">
        <span class="row-label"><ha-icon icon="mdi:chart-line"></ha-icon>${this._t("card.history")}</span>
        <hcc-history-graph .hass=${o} .entity=${t.entity_id}
          .sensor=${this._config.use_sensor_for_current?this._config.temperature_sensor:void 0}
          .hours=${this._config.graph_hours??24} .unit=${this._unit} .emptyText=${this._t("card.no_history")}
          style="--hcc-accent:${e}"></hcc-history-graph>
      </div>`,"graph"),n}_renderSections(t,e){return t.length?W`<div class="controls" style="--hcc-accent:${e}">${t.map(t=>t.tpl)}</div>`:q}_renderExpandButton(){return W`<button class="expand" @click=${()=>{this._expanded=!this._expanded}} aria-expanded=${this._expanded}>
      <span>${this._t(this._expanded?"card.less":"card.more")}</span>
      <ha-icon icon=${this._expanded?"mdi:chevron-up":"mdi:chevron-down"}></ha-icon>
    </button>`}_renderFullControls(t,e){const i=this._sections(t,e);if(!1===this._config.expandable)return this._renderSections(i,e);const s=i.filter(t=>Mt.includes(t.key)),o=i.filter(t=>!Mt.includes(t.key));return W`
      ${this._renderSections(s,e)}
      ${o.length?W`
        ${this._expanded?this._renderSections(o,e):q}
        ${this._renderExpandButton()}`:q}`}_sensorItems(t){const e=this._config,i=[],s=(t,e,s,o=!1)=>{const n=this._sensorState(t);null!=n&&i.push({entity:t,icon:e,label:this._t(s),value:n,warning:o})};if(e.use_sensor_for_current||s(e.temperature_sensor,"mdi:home-thermometer-outline","card.current"),null==e.humidity_sensor&&null!=t.attributes.current_humidity&&"compact"===this._config?.layout&&i.push({icon:"mdi:water-percent",label:this._t("card.humidity"),value:`${t.attributes.current_humidity}%`}),"compact"===this._config?.layout&&s(e.humidity_sensor,"mdi:water-percent","card.humidity"),s(e.outdoor_sensor,"mdi:thermometer","card.outdoor"),s(e.power_sensor,"mdi:flash","card.power"),s(e.energy_sensor,"mdi:lightning-bolt","card.energy"),e.window_sensor&&this.hass.states[e.window_sensor]){const t=this._windowOpen();i.push({entity:e.window_sensor,icon:t?"mdi:window-open-variant":"mdi:window-closed-variant",label:this.hass.states[e.window_sensor].attributes.friendly_name??"Window",value:this._sensorState(e.window_sensor)??"",warning:t})}return i}_renderCompact(t,e,i){const s=this._step(t),o=this._isDual(t),n=this._targets(t),r="off"===t.state,a=o||null!=n.value&&kt(t.attributes,ft),l=this._currentTemp(t);return W`
      <div class="compact-top">
        ${this._renderHeader(t,e,i)}
      </div>
      <div class="compact-row">
        <div class="compact-current">
          <span class="big">${this._fmt(l,s)}<sup>${this._unit}</sup></span>
          <span class="dial-label">${this._t("card.current")}</span>
        </div>
        ${!r&&a?o?W`<div class="compact-steppers">
                ${this._renderStepper("low",n.low,s,"var(--state-climate-heat-color,#ff6d00)")}
                ${this._renderStepper("high",n.high,s,"var(--state-climate-cool-color,#2196f3)")}
              </div>`:this._renderStepper("value",n.value,s,i):q}
      </div>
      ${this._renderWindowWarning()}
      ${this._renderExpandButton()}
      ${this._expanded?this._renderSections(this._sections(t,i),i):q}`}render(){if(!this._config||!this.hass)return q;const t=this._stateObj;if(!t)return W`<ha-card><div class="warning">${this._t("card.entity_not_found")}: ${this._config.entity}</div></ha-card>`;const e=this._config.name??t.attributes.friendly_name??t.entity_id;if(se.includes(t.state))return W`<ha-card class="unavailable">
        ${this._renderHeader(t,e,Tt.off)}
        <div class="warning">${this._t("card.unavailable")}</div>
      </ha-card>`;const i=this._modeColor(t),s="compact"===this._config.layout;return W`<ha-card class=${s?"compact":"full"} style="--accent:${i}">
      <div class="glow"></div>
      ${s?this._renderCompact(t,e,i):W`
          ${this._renderHeader(t,e,i)}
          ${this._renderWindowWarning()}
          ${this._renderDial(t,i)}
          ${this._renderFullControls(t,i)}`}
    </ha-card>`}};oe.styles=Lt,t([mt({attribute:!1})],oe.prototype,"hass",void 0),t([_t()],oe.prototype,"_config",void 0),t([_t()],oe.prototype,"_pending",void 0),t([_t()],oe.prototype,"_pendingHumidity",void 0),t([_t()],oe.prototype,"_expanded",void 0),oe=t([dt("ha-climate-card")],oe);export{oe as HaClimateCard};
