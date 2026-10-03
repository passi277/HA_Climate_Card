function t(t,e,i,s){var o,r=arguments.length,n=r<3?e:null===s?s=Object.getOwnPropertyDescriptor(e,i):s;if("object"==typeof Reflect&&"function"==typeof Reflect.decorate)n=Reflect.decorate(t,e,i,s);else for(var a=t.length-1;a>=0;a--)(o=t[a])&&(n=(r<3?o(n):r>3?o(e,i,n):o(e,i))||n);return r>3&&n&&Object.defineProperty(e,i,n),n}"function"==typeof SuppressedError&&SuppressedError;const e=globalThis,i=e.ShadowRoot&&(void 0===e.ShadyCSS||e.ShadyCSS.nativeShadow)&&"adoptedStyleSheets"in Document.prototype&&"replace"in CSSStyleSheet.prototype,s=Symbol(),o=new WeakMap;let r=class{constructor(t,e,i){if(this._$cssResult$=!0,i!==s)throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");this.cssText=t,this.t=e}get styleSheet(){let t=this.o;const e=this.t;if(i&&void 0===t){const i=void 0!==e&&1===e.length;i&&(t=o.get(e)),void 0===t&&((this.o=t=new CSSStyleSheet).replaceSync(this.cssText),i&&o.set(e,t))}return t}toString(){return this.cssText}};const n=(t,...e)=>{const i=1===t.length?t[0]:e.reduce((e,i,s)=>e+(t=>{if(!0===t._$cssResult$)return t.cssText;if("number"==typeof t)return t;throw Error("Value passed to 'css' function must be a 'css' function result: "+t+". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.")})(i)+t[s+1],t[0]);return new r(i,t,s)},a=i?t=>t:t=>t instanceof CSSStyleSheet?(t=>{let e="";for(const i of t.cssRules)e+=i.cssText;return(t=>new r("string"==typeof t?t:t+"",void 0,s))(e)})(t):t,{is:l,defineProperty:c,getOwnPropertyDescriptor:h,getOwnPropertyNames:d,getOwnPropertySymbols:p,getPrototypeOf:u}=Object,m=globalThis,_=m.trustedTypes,f=_?_.emptyScript:"",g=m.reactiveElementPolyfillSupport,y=(t,e)=>t,v={toAttribute(t,e){switch(e){case Boolean:t=t?f:null;break;case Object:case Array:t=null==t?t:JSON.stringify(t)}return t},fromAttribute(t,e){let i=t;switch(e){case Boolean:i=null!==t;break;case Number:i=null===t?null:Number(t);break;case Object:case Array:try{i=JSON.parse(t)}catch(t){i=null}}return i}},b=(t,e)=>!l(t,e),$={attribute:!0,type:String,converter:v,reflect:!1,useDefault:!1,hasChanged:b};Symbol.metadata??=Symbol("metadata"),m.litPropertyMetadata??=new WeakMap;let w=class extends HTMLElement{static addInitializer(t){this._$Ei(),(this.l??=[]).push(t)}static get observedAttributes(){return this.finalize(),this._$Eh&&[...this._$Eh.keys()]}static createProperty(t,e=$){if(e.state&&(e.attribute=!1),this._$Ei(),this.prototype.hasOwnProperty(t)&&((e=Object.create(e)).wrapped=!0),this.elementProperties.set(t,e),!e.noAccessor){const i=Symbol(),s=this.getPropertyDescriptor(t,i,e);void 0!==s&&c(this.prototype,t,s)}}static getPropertyDescriptor(t,e,i){const{get:s,set:o}=h(this.prototype,t)??{get(){return this[e]},set(t){this[e]=t}};return{get:s,set(e){const r=s?.call(this);o?.call(this,e),this.requestUpdate(t,r,i)},configurable:!0,enumerable:!0}}static getPropertyOptions(t){return this.elementProperties.get(t)??$}static _$Ei(){if(this.hasOwnProperty(y("elementProperties")))return;const t=u(this);t.finalize(),void 0!==t.l&&(this.l=[...t.l]),this.elementProperties=new Map(t.elementProperties)}static finalize(){if(this.hasOwnProperty(y("finalized")))return;if(this.finalized=!0,this._$Ei(),this.hasOwnProperty(y("properties"))){const t=this.properties,e=[...d(t),...p(t)];for(const i of e)this.createProperty(i,t[i])}const t=this[Symbol.metadata];if(null!==t){const e=litPropertyMetadata.get(t);if(void 0!==e)for(const[t,i]of e)this.elementProperties.set(t,i)}this._$Eh=new Map;for(const[t,e]of this.elementProperties){const i=this._$Eu(t,e);void 0!==i&&this._$Eh.set(i,t)}this.elementStyles=this.finalizeStyles(this.styles)}static finalizeStyles(t){const e=[];if(Array.isArray(t)){const i=new Set(t.flat(1/0).reverse());for(const t of i)e.unshift(a(t))}else void 0!==t&&e.push(a(t));return e}static _$Eu(t,e){const i=e.attribute;return!1===i?void 0:"string"==typeof i?i:"string"==typeof t?t.toLowerCase():void 0}constructor(){super(),this._$Ep=void 0,this.isUpdatePending=!1,this.hasUpdated=!1,this._$Em=null,this._$Ev()}_$Ev(){this._$ES=new Promise(t=>this.enableUpdating=t),this._$AL=new Map,this._$E_(),this.requestUpdate(),this.constructor.l?.forEach(t=>t(this))}addController(t){(this._$EO??=new Set).add(t),void 0!==this.renderRoot&&this.isConnected&&t.hostConnected?.()}removeController(t){this._$EO?.delete(t)}_$E_(){const t=new Map,e=this.constructor.elementProperties;for(const i of e.keys())this.hasOwnProperty(i)&&(t.set(i,this[i]),delete this[i]);t.size>0&&(this._$Ep=t)}createRenderRoot(){const t=this.shadowRoot??this.attachShadow(this.constructor.shadowRootOptions);return((t,s)=>{if(i)t.adoptedStyleSheets=s.map(t=>t instanceof CSSStyleSheet?t:t.styleSheet);else for(const i of s){const s=document.createElement("style"),o=e.litNonce;void 0!==o&&s.setAttribute("nonce",o),s.textContent=i.cssText,t.appendChild(s)}})(t,this.constructor.elementStyles),t}connectedCallback(){this.renderRoot??=this.createRenderRoot(),this.enableUpdating(!0),this._$EO?.forEach(t=>t.hostConnected?.())}enableUpdating(t){}disconnectedCallback(){this._$EO?.forEach(t=>t.hostDisconnected?.())}attributeChangedCallback(t,e,i){this._$AK(t,i)}_$ET(t,e){const i=this.constructor.elementProperties.get(t),s=this.constructor._$Eu(t,i);if(void 0!==s&&!0===i.reflect){const o=(void 0!==i.converter?.toAttribute?i.converter:v).toAttribute(e,i.type);this._$Em=t,null==o?this.removeAttribute(s):this.setAttribute(s,o),this._$Em=null}}_$AK(t,e){const i=this.constructor,s=i._$Eh.get(t);if(void 0!==s&&this._$Em!==s){const t=i.getPropertyOptions(s),o="function"==typeof t.converter?{fromAttribute:t.converter}:void 0!==t.converter?.fromAttribute?t.converter:v;this._$Em=s;const r=o.fromAttribute(e,t.type);this[s]=r??this._$Ej?.get(s)??r,this._$Em=null}}requestUpdate(t,e,i,s=!1,o){if(void 0!==t){const r=this.constructor;if(!1===s&&(o=this[t]),i??=r.getPropertyOptions(t),!((i.hasChanged??b)(o,e)||i.useDefault&&i.reflect&&o===this._$Ej?.get(t)&&!this.hasAttribute(r._$Eu(t,i))))return;this.C(t,e,i)}!1===this.isUpdatePending&&(this._$ES=this._$EP())}C(t,e,{useDefault:i,reflect:s,wrapped:o},r){i&&!(this._$Ej??=new Map).has(t)&&(this._$Ej.set(t,r??e??this[t]),!0!==o||void 0!==r)||(this._$AL.has(t)||(this.hasUpdated||i||(e=void 0),this._$AL.set(t,e)),!0===s&&this._$Em!==t&&(this._$Eq??=new Set).add(t))}async _$EP(){this.isUpdatePending=!0;try{await this._$ES}catch(t){Promise.reject(t)}const t=this.scheduleUpdate();return null!=t&&await t,!this.isUpdatePending}scheduleUpdate(){return this.performUpdate()}performUpdate(){if(!this.isUpdatePending)return;if(!this.hasUpdated){if(this.renderRoot??=this.createRenderRoot(),this._$Ep){for(const[t,e]of this._$Ep)this[t]=e;this._$Ep=void 0}const t=this.constructor.elementProperties;if(t.size>0)for(const[e,i]of t){const{wrapped:t}=i,s=this[e];!0!==t||this._$AL.has(e)||void 0===s||this.C(e,void 0,i,s)}}let t=!1;const e=this._$AL;try{t=this.shouldUpdate(e),t?(this.willUpdate(e),this._$EO?.forEach(t=>t.hostUpdate?.()),this.update(e)):this._$EM()}catch(e){throw t=!1,this._$EM(),e}t&&this._$AE(e)}willUpdate(t){}_$AE(t){this._$EO?.forEach(t=>t.hostUpdated?.()),this.hasUpdated||(this.hasUpdated=!0,this.firstUpdated(t)),this.updated(t)}_$EM(){this._$AL=new Map,this.isUpdatePending=!1}get updateComplete(){return this.getUpdateComplete()}getUpdateComplete(){return this._$ES}shouldUpdate(t){return!0}update(t){this._$Eq&&=this._$Eq.forEach(t=>this._$ET(t,this[t])),this._$EM()}updated(t){}firstUpdated(t){}};w.elementStyles=[],w.shadowRootOptions={mode:"open"},w[y("elementProperties")]=new Map,w[y("finalized")]=new Map,g?.({ReactiveElement:w}),(m.reactiveElementVersions??=[]).push("2.1.2");const x=globalThis,A=t=>t,k=x.trustedTypes,E=k?k.createPolicy("lit-html",{createHTML:t=>t}):void 0,C="$lit$",S=`lit$${Math.random().toFixed(9).slice(2)}$`,T="?"+S,P=`<${T}>`,N=document,M=()=>N.createComment(""),H=t=>null===t||"object"!=typeof t&&"function"!=typeof t,O=Array.isArray,z="[ \t\n\f\r]",U=/<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g,j=/-->/g,D=/>/g,R=RegExp(`>|${z}(?:([^\\s"'>=/]+)(${z}*=${z}*(?:[^ \t\n\f\r"'\`<>=]|("|')|))|$)`,"g"),L=/'/g,I=/"/g,F=/^(?:script|style|textarea|title)$/i,B=t=>(e,...i)=>({_$litType$:t,strings:e,values:i}),W=B(1),V=B(2),K=Symbol.for("lit-noChange"),q=Symbol.for("lit-nothing"),G=new WeakMap,Z=N.createTreeWalker(N,129);function J(t,e){if(!O(t)||!t.hasOwnProperty("raw"))throw Error("invalid template strings array");return void 0!==E?E.createHTML(e):e}const X=(t,e)=>{const i=t.length-1,s=[];let o,r=2===e?"<svg>":3===e?"<math>":"",n=U;for(let e=0;e<i;e++){const i=t[e];let a,l,c=-1,h=0;for(;h<i.length&&(n.lastIndex=h,l=n.exec(i),null!==l);)h=n.lastIndex,n===U?"!--"===l[1]?n=j:void 0!==l[1]?n=D:void 0!==l[2]?(F.test(l[2])&&(o=RegExp("</"+l[2],"g")),n=R):void 0!==l[3]&&(n=R):n===R?">"===l[0]?(n=o??U,c=-1):void 0===l[1]?c=-2:(c=n.lastIndex-l[2].length,a=l[1],n=void 0===l[3]?R:'"'===l[3]?I:L):n===I||n===L?n=R:n===j||n===D?n=U:(n=R,o=void 0);const d=n===R&&t[e+1].startsWith("/>")?" ":"";r+=n===U?i+P:c>=0?(s.push(a),i.slice(0,c)+C+i.slice(c)+S+d):i+S+(-2===c?e:d)}return[J(t,r+(t[i]||"<?>")+(2===e?"</svg>":3===e?"</math>":"")),s]};class Y{constructor({strings:t,_$litType$:e},i){let s;this.parts=[];let o=0,r=0;const n=t.length-1,a=this.parts,[l,c]=X(t,e);if(this.el=Y.createElement(l,i),Z.currentNode=this.el.content,2===e||3===e){const t=this.el.content.firstChild;t.replaceWith(...t.childNodes)}for(;null!==(s=Z.nextNode())&&a.length<n;){if(1===s.nodeType){if(s.hasAttributes())for(const t of s.getAttributeNames())if(t.endsWith(C)){const e=c[r++],i=s.getAttribute(t).split(S),n=/([.?@])?(.*)/.exec(e);a.push({type:1,index:o,name:n[2],strings:i,ctor:"."===n[1]?st:"?"===n[1]?ot:"@"===n[1]?rt:it}),s.removeAttribute(t)}else t.startsWith(S)&&(a.push({type:6,index:o}),s.removeAttribute(t));if(F.test(s.tagName)){const t=s.textContent.split(S),e=t.length-1;if(e>0){s.textContent=k?k.emptyScript:"";for(let i=0;i<e;i++)s.append(t[i],M()),Z.nextNode(),a.push({type:2,index:++o});s.append(t[e],M())}}}else if(8===s.nodeType)if(s.data===T)a.push({type:2,index:o});else{let t=-1;for(;-1!==(t=s.data.indexOf(S,t+1));)a.push({type:7,index:o}),t+=S.length-1}o++}}static createElement(t,e){const i=N.createElement("template");return i.innerHTML=t,i}}function Q(t,e,i=t,s){if(e===K)return e;let o=void 0!==s?i._$Co?.[s]:i._$Cl;const r=H(e)?void 0:e._$litDirective$;return o?.constructor!==r&&(o?._$AO?.(!1),void 0===r?o=void 0:(o=new r(t),o._$AT(t,i,s)),void 0!==s?(i._$Co??=[])[s]=o:i._$Cl=o),void 0!==o&&(e=Q(t,o._$AS(t,e.values),o,s)),e}let tt=class{constructor(t,e){this._$AV=[],this._$AN=void 0,this._$AD=t,this._$AM=e}get parentNode(){return this._$AM.parentNode}get _$AU(){return this._$AM._$AU}u(t){const{el:{content:e},parts:i}=this._$AD,s=(t?.creationScope??N).importNode(e,!0);Z.currentNode=s;let o=Z.nextNode(),r=0,n=0,a=i[0];for(;void 0!==a;){if(r===a.index){let e;2===a.type?e=new et(o,o.nextSibling,this,t):1===a.type?e=new a.ctor(o,a.name,a.strings,this,t):6===a.type&&(e=new nt(o,this,t)),this._$AV.push(e),a=i[++n]}r!==a?.index&&(o=Z.nextNode(),r++)}return Z.currentNode=N,s}p(t){let e=0;for(const i of this._$AV)void 0!==i&&(void 0!==i.strings?(i._$AI(t,i,e),e+=i.strings.length-2):i._$AI(t[e])),e++}};class et{get _$AU(){return this._$AM?._$AU??this._$Cv}constructor(t,e,i,s){this.type=2,this._$AH=q,this._$AN=void 0,this._$AA=t,this._$AB=e,this._$AM=i,this.options=s,this._$Cv=s?.isConnected??!0}get parentNode(){let t=this._$AA.parentNode;const e=this._$AM;return void 0!==e&&11===t?.nodeType&&(t=e.parentNode),t}get startNode(){return this._$AA}get endNode(){return this._$AB}_$AI(t,e=this){t=Q(this,t,e),H(t)?t===q||null==t||""===t?(this._$AH!==q&&this._$AR(),this._$AH=q):t!==this._$AH&&t!==K&&this._(t):void 0!==t._$litType$?this.$(t):void 0!==t.nodeType?this.T(t):(t=>O(t)||"function"==typeof t?.[Symbol.iterator])(t)?this.k(t):this._(t)}O(t){return this._$AA.parentNode.insertBefore(t,this._$AB)}T(t){this._$AH!==t&&(this._$AR(),this._$AH=this.O(t))}_(t){this._$AH!==q&&H(this._$AH)?this._$AA.nextSibling.data=t:this.T(N.createTextNode(t)),this._$AH=t}$(t){const{values:e,_$litType$:i}=t,s="number"==typeof i?this._$AC(t):(void 0===i.el&&(i.el=Y.createElement(J(i.h,i.h[0]),this.options)),i);if(this._$AH?._$AD===s)this._$AH.p(e);else{const t=new tt(s,this),i=t.u(this.options);t.p(e),this.T(i),this._$AH=t}}_$AC(t){let e=G.get(t.strings);return void 0===e&&G.set(t.strings,e=new Y(t)),e}k(t){O(this._$AH)||(this._$AH=[],this._$AR());const e=this._$AH;let i,s=0;for(const o of t)s===e.length?e.push(i=new et(this.O(M()),this.O(M()),this,this.options)):i=e[s],i._$AI(o),s++;s<e.length&&(this._$AR(i&&i._$AB.nextSibling,s),e.length=s)}_$AR(t=this._$AA.nextSibling,e){for(this._$AP?.(!1,!0,e);t!==this._$AB;){const e=A(t).nextSibling;A(t).remove(),t=e}}setConnected(t){void 0===this._$AM&&(this._$Cv=t,this._$AP?.(t))}}let it=class{get tagName(){return this.element.tagName}get _$AU(){return this._$AM._$AU}constructor(t,e,i,s,o){this.type=1,this._$AH=q,this._$AN=void 0,this.element=t,this.name=e,this._$AM=s,this.options=o,i.length>2||""!==i[0]||""!==i[1]?(this._$AH=Array(i.length-1).fill(new String),this.strings=i):this._$AH=q}_$AI(t,e=this,i,s){const o=this.strings;let r=!1;if(void 0===o)t=Q(this,t,e,0),r=!H(t)||t!==this._$AH&&t!==K,r&&(this._$AH=t);else{const s=t;let n,a;for(t=o[0],n=0;n<o.length-1;n++)a=Q(this,s[i+n],e,n),a===K&&(a=this._$AH[n]),r||=!H(a)||a!==this._$AH[n],a===q?t=q:t!==q&&(t+=(a??"")+o[n+1]),this._$AH[n]=a}r&&!s&&this.j(t)}j(t){t===q?this.element.removeAttribute(this.name):this.element.setAttribute(this.name,t??"")}};class st extends it{constructor(){super(...arguments),this.type=3}j(t){this.element[this.name]=t===q?void 0:t}}class ot extends it{constructor(){super(...arguments),this.type=4}j(t){this.element.toggleAttribute(this.name,!!t&&t!==q)}}class rt extends it{constructor(t,e,i,s,o){super(t,e,i,s,o),this.type=5}_$AI(t,e=this){if((t=Q(this,t,e,0)??q)===K)return;const i=this._$AH,s=t===q&&i!==q||t.capture!==i.capture||t.once!==i.once||t.passive!==i.passive,o=t!==q&&(i===q||s);s&&this.element.removeEventListener(this.name,this,i),o&&this.element.addEventListener(this.name,this,t),this._$AH=t}handleEvent(t){"function"==typeof this._$AH?this._$AH.call(this.options?.host??this.element,t):this._$AH.handleEvent(t)}}class nt{constructor(t,e,i){this.element=t,this.type=6,this._$AN=void 0,this._$AM=e,this.options=i}get _$AU(){return this._$AM._$AU}_$AI(t){Q(this,t)}}const at=x.litHtmlPolyfillSupport;at?.(Y,et),(x.litHtmlVersions??=[]).push("3.3.3");const lt=globalThis;class ct extends w{constructor(){super(...arguments),this.renderOptions={host:this},this._$Do=void 0}createRenderRoot(){const t=super.createRenderRoot();return this.renderOptions.renderBefore??=t.firstChild,t}update(t){const e=this.render();this.hasUpdated||(this.renderOptions.isConnected=this.isConnected),super.update(t),this._$Do=((t,e,i)=>{const s=i?.renderBefore??e;let o=s._$litPart$;if(void 0===o){const t=i?.renderBefore??null;s._$litPart$=o=new et(e.insertBefore(M(),t),t,void 0,i??{})}return o._$AI(t),o})(e,this.renderRoot,this.renderOptions)}connectedCallback(){super.connectedCallback(),this._$Do?.setConnected(!0)}disconnectedCallback(){super.disconnectedCallback(),this._$Do?.setConnected(!1)}render(){return K}}ct._$litElement$=!0,ct.finalized=!0,lt.litElementHydrateSupport?.({LitElement:ct});const ht=lt.litElementPolyfillSupport;ht?.({LitElement:ct}),(lt.litElementVersions??=[]).push("4.2.2");const dt=t=>(e,i)=>{void 0!==i?i.addInitializer(()=>{customElements.define(t,e)}):customElements.define(t,e)},pt={attribute:!0,type:String,converter:v,reflect:!1,hasChanged:b},ut=(t=pt,e,i)=>{const{kind:s,metadata:o}=i;let r=globalThis.litPropertyMetadata.get(o);if(void 0===r&&globalThis.litPropertyMetadata.set(o,r=new Map),"setter"===s&&((t=Object.create(t)).wrapped=!0),r.set(i.name,t),"accessor"===s){const{name:s}=i;return{set(i){const o=e.get.call(this);e.set.call(this,i),this.requestUpdate(s,o,t,!0,i)},init(e){return void 0!==e&&this.C(s,void 0,t,e),e}}}if("setter"===s){const{name:s}=i;return function(i){const o=this[s];e.call(this,i),this.requestUpdate(s,o,t,!0,i)}}throw Error("Unsupported decorator location: "+s)};function mt(t){return(e,i)=>"object"==typeof i?ut(t,e,i):((t,e,i)=>{const s=e.hasOwnProperty(i);return e.constructor.createProperty(i,t),s?Object.getOwnPropertyDescriptor(e,i):void 0})(t,e,i)}function _t(t){return mt({...t,state:!0,attribute:!1})}const ft=1,gt=2,yt=4,vt=8,bt=16,$t=32,wt=128,xt=256,At=512,kt=(t,e)=>0!==((t.supported_features??0)&e),Et=["auto","heat_cool","heat","cool","dry","fan_only","off"],Ct={auto:"mdi:thermostat-auto",heat_cool:"mdi:sun-snowflake-variant",heat:"mdi:fire",cool:"mdi:snowflake",dry:"mdi:water-percent",fan_only:"mdi:fan",off:"mdi:power"},St={heating:"mdi:fire",cooling:"mdi:snowflake",drying:"mdi:water-percent",fan:"mdi:fan",idle:"mdi:clock-outline",off:"mdi:power",preheating:"mdi:heat-wave",defrosting:"mdi:snowflake-melt"},Tt={auto:"var(--state-climate-auto-color, #43a047)",heat_cool:"var(--state-climate-heat_cool-color, #ffa000)",heat:"var(--state-climate-heat-color, #ff6d00)",cool:"var(--state-climate-cool-color, #2196f3)",dry:"var(--state-climate-dry-color, #00bcd4)",fan_only:"var(--state-climate-fan_only-color, #00acc1)",off:"var(--state-climate-off-color, #8a8a8a)"},Pt={heating:"heat",preheating:"heat",cooling:"cool",drying:"dry",fan:"fan_only",defrosting:"cool"},Nt={modes:!0,fan:!0,swing:!0,presets:!0,humidity:!0,sensors:!0,graph:!1};const Mt={de:{card:{current:"Aktuell",target:"Ziel",humidity:"Luftfeuchte",target_humidity:"Ziel-Luftfeuchte",outdoor:"Außen",power:"Leistung",energy:"Energie",fan:"Lüfter",swing:"Lamellen",swing_horizontal:"Lamellen horizontal",preset:"Voreinstellung",mode:"Modus",history:"Verlauf",window_open:"Fenster offen",window_open_hint:"Ein Fenster ist geöffnet – Klimaanlage ggf. ausschalten.",unavailable:"Nicht verfügbar",entity_not_found:"Entität nicht gefunden",more:"Mehr",less:"Weniger",turn_on:"Einschalten",turn_off:"Ausschalten",no_history:"Keine Verlaufsdaten"},hvac_mode:{off:"Aus",heat:"Heizen",cool:"Kühlen",heat_cool:"Heizen/Kühlen",auto:"Automatisch",dry:"Entfeuchten",fan_only:"Nur Lüfter"},hvac_action:{off:"Aus",heating:"Heizt",cooling:"Kühlt",drying:"Entfeuchtet",idle:"Leerlauf",fan:"Lüftet",preheating:"Vorheizen",defrosting:"Abtauen"},editor:{entity:"Klima-Entität",name:"Name",icon:"Symbol",layout:"Layout",layout_full:"Voll (Drehregler)",layout_compact:"Kompakt (Kachel)",sections:"Sichtbare Bereiche",show_modes:"Betriebsmodi",show_fan:"Lüfterstufen",show_swing:"Lamellen",show_presets:"Voreinstellungen",show_humidity:"Ziel-Luftfeuchte",show_sensors:"Sensoren",show_graph:"Verlaufsgraph",sensors:"Zusätzliche Sensoren",temperature_sensor:"Raumtemperatur-Sensor",humidity_sensor:"Raumluftfeuchte-Sensor",outdoor_sensor:"Außentemperatur-Sensor",power_sensor:"Leistungssensor",energy_sensor:"Energiesensor",window_sensor:"Fenster-/Türkontakt",use_sensor_for_current:"Raumsensor als Ist-Temperatur verwenden",graph_hours:"Zeitraum Graph (Stunden)"}},en:{card:{current:"Current",target:"Target",humidity:"Humidity",target_humidity:"Target humidity",outdoor:"Outdoor",power:"Power",energy:"Energy",fan:"Fan",swing:"Swing",swing_horizontal:"Horizontal swing",preset:"Preset",mode:"Mode",history:"History",window_open:"Window open",window_open_hint:"A window is open – consider turning off the air conditioner.",unavailable:"Unavailable",entity_not_found:"Entity not found",more:"More",less:"Less",turn_on:"Turn on",turn_off:"Turn off",no_history:"No history data"},hvac_mode:{off:"Off",heat:"Heat",cool:"Cool",heat_cool:"Heat/Cool",auto:"Auto",dry:"Dry",fan_only:"Fan only"},hvac_action:{off:"Off",heating:"Heating",cooling:"Cooling",drying:"Drying",idle:"Idle",fan:"Fan",preheating:"Preheating",defrosting:"Defrosting"},editor:{entity:"Climate entity",name:"Name",icon:"Icon",layout:"Layout",layout_full:"Full (dial)",layout_compact:"Compact (tile)",sections:"Visible sections",show_modes:"HVAC modes",show_fan:"Fan modes",show_swing:"Swing modes",show_presets:"Presets",show_humidity:"Target humidity",show_sensors:"Sensors",show_graph:"History graph",sensors:"Additional sensors",temperature_sensor:"Room temperature sensor",humidity_sensor:"Room humidity sensor",outdoor_sensor:"Outdoor temperature sensor",power_sensor:"Power sensor",energy_sensor:"Energy sensor",window_sensor:"Window / door contact",use_sensor_for_current:"Use room sensor as current temperature",graph_hours:"Graph period (hours)"}}},Ht=(t,e)=>{let i=Mt[t];for(const t of e.split(".")){if(null==i||"object"!=typeof i)return;i=i[t]}return"string"==typeof i?i:void 0},Ot=t=>{const e=(t?.locale?.language??t?.language??navigator.language??"en").split("-")[0].toLowerCase();return e in Mt?e:"en"},zt=(t,e)=>Ht(Ot(t),e)??Ht("en",e)??e,Ut=t=>t.replace(/_/g," ").replace(/^\w/,t=>t.toUpperCase()),jt=(t,e,i,s)=>{if(t.formatEntityAttributeValue){const o=t.formatEntityAttributeValue(e,i,s);if(o&&o!==s)return o}return"hvac_action"===i?Ht(Ot(t),`hvac_action.${s}`)??Ut(s):Ut(s)},Dt=(t,e,i)=>{if(t.formatEntityState){const s=t.formatEntityState(e,i);if(s&&s!==i)return s}return Ht(Ot(t),`hvac_mode.${i}`)??Ut(i)},Rt=n`
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
`,Lt=135,It=270,Ft=(t,e=82)=>{const i=t*Math.PI/180;return{x:100+e*Math.cos(i),y:100+e*Math.sin(i)}},Bt=(t,e,i=82)=>{if(e-t<.01)return"";const s=Ft(t,i),o=Ft(e,i),r=e-t>180?1:0;return`M ${s.x} ${s.y} A ${i} ${i} 0 ${r} 1 ${o.x} ${o.y}`};let Wt=class extends ct{constructor(){super(...arguments),this.min=16,this.max=30,this.step=.5,this.dual=!1,this.disabled=!1,this.color="var(--primary-color)",this.lowColor="var(--state-climate-heat-color, #ff6d00)",this.highColor="var(--state-climate-cool-color, #2196f3)",this.active=!1}_clamp(t){const e=Math.round((t-this.min)/this.step)*this.step+this.min,i=Number(e.toFixed(this.step<1?1:0));return Math.min(this.max,Math.max(this.min,i))}_toAngle(t){const e=this.max-this.min||1,i=Math.min(1,Math.max(0,(t-this.min)/e));return Lt+It*i}_fromPointer(t){const e=this.shadowRoot.querySelector("svg").getBoundingClientRect(),i=(t.clientX-e.left)/e.width*200-100,s=(t.clientY-e.top)/e.height*200-100;let o=(180*Math.atan2(s,i)/Math.PI-Lt+720)%360;return o>It&&(o=o>315?0:It),this._clamp(this.min+o/It*(this.max-this.min))}_pickHandle(t){if(!this.dual)return"value";const e=this.low??this.min,i=this.high??this.max;return t<=e?"low":t>=i?"high":t-e<i-t?"low":"high"}_apply(t,e){"value"===t?this.value=e:"low"===t?this.low=Math.min(e,this.high??this.max):this.high=Math.max(e,this.low??this.min)}_emit(t){const e=this.dual?{low:this.low,high:this.high}:{value:this.value};this.dispatchEvent(new CustomEvent(t,{detail:e,bubbles:!0,composed:!0}))}_onPointerDown(t){if(this.disabled)return;t.preventDefault();const e=this._fromPointer(t);this._dragging=this._pickHandle(e),t.currentTarget.setPointerCapture(t.pointerId),this._apply(this._dragging,e),this._emit("value-changing")}_onPointerMove(t){this._dragging&&(this._apply(this._dragging,this._fromPointer(t)),this._emit("value-changing"))}_onPointerUp(t){this._dragging&&(t.currentTarget.releasePointerCapture?.(t.pointerId),this._dragging=void 0,this._emit("value-changed"))}_onKey(t,e){if(this.disabled)return;const i={ArrowUp:this.step,ArrowRight:this.step,ArrowDown:-this.step,ArrowLeft:-this.step,PageUp:5*this.step,PageDown:5*-this.step};if(!(e.key in i))return;e.preventDefault();const s="value"===t?this.value:"low"===t?this.low:this.high;this._apply(t,this._clamp((s??this.min)+i[e.key])),this._emit("value-changed")}_handle(t,e,i){if(null==e)return q;const s=Ft(this._toAngle(e));return V`
      <g class="handle ${this._dragging===t?"dragging":""}" tabindex=${this.disabled?-1:0}
        role="slider" aria-valuemin=${this.min} aria-valuemax=${this.max} aria-valuenow=${e}
        aria-label=${t} @keydown=${e=>this._onKey(t,e)}>
        <circle cx=${s.x} cy=${s.y} r="13" class="halo" style="fill:${i}"></circle>
        <circle cx=${s.x} cy=${s.y} r="9" class="knob" style="stroke:${i}"></circle>
      </g>`}render(){let t=q;this.disabled||(this.dual&&null!=this.low&&null!=this.high?t=V`<path class="active" d=${Bt(this._toAngle(this.low),this._toAngle(this.high))}
          style="stroke:url(#rangeGrad)"></path>`:null!=this.value&&(t=V`<path class="active" d=${Bt(Lt,this._toAngle(this.value))}
          style="stroke:${this.color}"></path>`));const e=null!=this.current&&this.current>=this.min&&this.current<=this.max?Ft(this._toAngle(this.current),82):void 0,i=Array.from({length:55},(t,e)=>Lt+5*e);return W`
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
          ${i.map(t=>{const e=Ft(t,98),i=Ft(t,93);return V`<line class="tick" x1=${e.x} y1=${e.y} x2=${i.x} y2=${i.y}></line>`})}
          <path class="track" d=${Bt(Lt,405)}></path>
          ${t}
          ${e?V`<circle class="current" cx=${e.x} cy=${e.y} r="3.5"></circle>`:q}
          ${this.disabled?q:this.dual?[this._handle("low",this.low,this.lowColor),this._handle("high",this.high,this.highColor)]:this._handle("value",this.value,this.color)}
        </svg>
        <div class="center"><slot></slot></div>
      </div>
    `}};Wt.styles=n`
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
  `,t([mt({type:Number})],Wt.prototype,"min",void 0),t([mt({type:Number})],Wt.prototype,"max",void 0),t([mt({type:Number})],Wt.prototype,"step",void 0),t([mt({type:Number})],Wt.prototype,"value",void 0),t([mt({type:Number})],Wt.prototype,"low",void 0),t([mt({type:Number})],Wt.prototype,"high",void 0),t([mt({type:Number})],Wt.prototype,"current",void 0),t([mt({type:Boolean})],Wt.prototype,"dual",void 0),t([mt({type:Boolean})],Wt.prototype,"disabled",void 0),t([mt()],Wt.prototype,"color",void 0),t([mt()],Wt.prototype,"lowColor",void 0),t([mt()],Wt.prototype,"highColor",void 0),t([mt({type:Boolean})],Wt.prototype,"active",void 0),t([_t()],Wt.prototype,"_dragging",void 0),Wt=t([dt("hcc-climate-dial")],Wt);let Vt=class extends ct{constructor(){super(...arguments),this.modes=[],this.disabled=!1}_select(t){this.disabled||t===this.selected||this.dispatchEvent(new CustomEvent("mode-selected",{detail:{mode:t},bubbles:!0,composed:!0}))}render(){return W`<div class="bar" role="radiogroup">
      ${this.modes.map(t=>W`
        <button class="mode ${t.value===this.selected?"on":""}" role="radio"
          aria-checked=${t.value===this.selected} title=${t.label} aria-label=${t.label}
          ?disabled=${this.disabled} style="--mode-color:${Tt[t.value]??"var(--primary-color)"}"
          @click=${()=>this._select(t.value)}>
          <ha-icon .icon=${Ct[t.value]??"mdi:thermostat"}></ha-icon>
        </button>`)}
    </div>`}};Vt.styles=n`
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
  `,t([mt({attribute:!1})],Vt.prototype,"modes",void 0),t([mt()],Vt.prototype,"selected",void 0),t([mt({type:Boolean})],Vt.prototype,"disabled",void 0),Vt=t([dt("hcc-mode-bar")],Vt);let Kt=class extends ct{constructor(){super(...arguments),this.label="",this.options=[],this.disabled=!1}_select(t){this.disabled||t===this.selected||this.dispatchEvent(new CustomEvent("option-selected",{detail:{value:t},bubbles:!0,composed:!0}))}render(){return W`
      <div class="head">
        ${this.icon?W`<ha-icon .icon=${this.icon}></ha-icon>`:q}
        <span>${this.label}</span>
      </div>
      <div class="chips" role="radiogroup" aria-label=${this.label}>
        ${this.options.map(t=>W`
          <button class="chip ${t.value===this.selected?"on":""}" role="radio"
            aria-checked=${t.value===this.selected} ?disabled=${this.disabled}
            @click=${()=>this._select(t.value)}>${t.label}</button>`)}
      </div>`}};Kt.styles=n`
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
  `,t([mt()],Kt.prototype,"label",void 0),t([mt()],Kt.prototype,"icon",void 0),t([mt()],Kt.prototype,"selected",void 0),t([mt({attribute:!1})],Kt.prototype,"options",void 0),t([mt({type:Boolean})],Kt.prototype,"disabled",void 0),Kt=t([dt("hcc-attribute-select")],Kt);let qt=class extends ct{constructor(){super(...arguments),this.items=[]}_open(t){t&&this.dispatchEvent(new CustomEvent("hass-more-info",{detail:{entityId:t},bubbles:!0,composed:!0}))}render(){return W`<div class="row">
      ${this.items.map(t=>W`
        <button class="item ${t.warning?"warn":""}" title=${t.label} @click=${()=>this._open(t.entity)}>
          <ha-icon .icon=${t.icon}></ha-icon>
          <div class="text"><span class="value">${t.value}</span><span class="label">${t.label}</span></div>
        </button>`)}
    </div>`}};qt.styles=n`
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
  `,t([mt({attribute:!1})],qt.prototype,"items",void 0),qt=t([dt("hcc-sensor-row")],qt);let Gt=class extends ct{constructor(){super(...arguments),this.hours=24,this.emptyText="",this.unit="",this._current=[],this._target=[],this._bands=[],this._loaded=!1,this._key=""}connectedCallback(){super.connectedCallback(),this._timer=window.setInterval(()=>this._fetch(),3e5)}disconnectedCallback(){super.disconnectedCallback(),clearInterval(this._timer)}updated(t){const e=`${this.entity}|${this.sensor}|${this.hours}`;this.hass&&e!==this._key&&(this._key=e,this._fetch()),super.updated(t)}async _fetch(){if(!this.hass||!this.entity)return;const t=new Date,e=new Date(t.getTime()-3600*this.hours*1e3),i=[this.entity,...this.sensor?[this.sensor]:[]];try{const s=await this.hass.callWS({type:"history/history_during_period",start_time:e.toISOString(),end_time:t.toISOString(),entity_ids:i,minimal_response:!1,no_attributes:!1,significant_changes_only:!1});this._parse(s,e.getTime(),t.getTime())}catch(t){console.warn("ha-climate-card: history fetch failed",t)}this._loaded=!0}_parse(t,e,i){const s=t[this.entity]??[],o=[],r=[],n=[];let a={};if(s.forEach((t,l)=>{t.a&&(a=t.a);const c=Math.max(1e3*t.lu,e),h=Number(a.current_temperature),d=Number(a.temperature??a.target_temp_high);!this.sensor&&Number.isFinite(h)&&o.push({t:c,v:h}),Number.isFinite(d)&&"off"!==t.s?r.push({t:c,v:d}):r.push({t:c,v:NaN});const p=Pt[a.hvac_action];if(p&&"off"!==t.s){const t=s[l+1]?1e3*s[l+1].lu:i;n.push({from:c,to:t,color:Tt[p]})}}),this.sensor)for(const i of t[this.sensor]??[]){const t=Number(i.s);Number.isFinite(t)&&o.push({t:Math.max(1e3*i.lu,e),v:t})}o.length&&o.push({t:i,v:o[o.length-1].v}),r.length&&r.push({t:i,v:r[r.length-1].v}),this._current=o,this._target=r,this._bands=n}_path(t,e,i,s){let o,r="";for(const n of t)Number.isFinite(n.v)?(r+=o?s?`H ${e(n.t).toFixed(1)} V ${i(n.v).toFixed(1)} `:`L ${e(n.t).toFixed(1)} ${i(n.v).toFixed(1)} `:`M ${e(n.t).toFixed(1)} ${i(n.v).toFixed(1)} `,o=n):o=void 0;return r}render(){if(!this._loaded)return W`<div class="placeholder"></div>`;const t=[...this._current,...this._target].map(t=>t.v).filter(Number.isFinite);if(!t.length)return W`<div class="placeholder empty">${this.emptyText}</div>`;const e=Date.now(),i=e-3600*this.hours*1e3;let s=Math.min(...t),o=Math.max(...t);const r=s,n=o;if(o-s<2){const t=(o+s)/2;s=t-1,o=t+1}const a=.15*(o-s);s-=a,o+=a;const l=t=>(t-i)/(e-i)*300,c=t=>80-(t-s)/(o-s)*80,h=this._current[this._current.length-1];return W`
      <div class="graph">
        <svg viewBox="0 0 ${300} ${80}" preserveAspectRatio="none">
          ${this._bands.map(t=>V`<rect x=${l(t.from)} y="0" width=${Math.max(.5,l(t.to)-l(t.from))}
            height=${80} style="fill:${t.color}" class="band"></rect>`)}
          <path class="target" d=${this._path(this._target,l,c,!0)}></path>
          <path class="current" d=${this._path(this._current,l,c,!1)}></path>
        </svg>
        <div class="labels">
          <span>-${this.hours}h</span>
          <span>${r.toFixed(1)}–${n.toFixed(1)}${this.unit}</span>
          ${h?W`<span>${h.v.toFixed(1)}${this.unit}</span>`:q}
        </div>
      </div>`}};Gt.styles=n`
    :host { display: block; }
    .graph svg { width: 100%; height: 80px; display: block; overflow: visible; }
    .band { opacity: 0.14; }
    .current { fill: none; stroke: var(--hcc-accent, var(--primary-color)); stroke-width: 2; vector-effect: non-scaling-stroke; stroke-linejoin: round; }
    .target { fill: none; stroke: var(--secondary-text-color); stroke-width: 1.5; stroke-dasharray: 4 3; vector-effect: non-scaling-stroke; opacity: 0.7; }
    .labels { display: flex; justify-content: space-between; font-size: 11px; color: var(--secondary-text-color); margin-top: 4px; }
    .placeholder { height: 80px; border-radius: 12px; background: rgba(127,127,127,0.08); }
    .placeholder.empty { display: flex; align-items: center; justify-content: center; font-size: 12px; color: var(--secondary-text-color); }
  `,t([mt({attribute:!1})],Gt.prototype,"hass",void 0),t([mt()],Gt.prototype,"entity",void 0),t([mt()],Gt.prototype,"sensor",void 0),t([mt({type:Number})],Gt.prototype,"hours",void 0),t([mt()],Gt.prototype,"emptyText",void 0),t([mt()],Gt.prototype,"unit",void 0),t([_t()],Gt.prototype,"_current",void 0),t([_t()],Gt.prototype,"_target",void 0),t([_t()],Gt.prototype,"_bands",void 0),t([_t()],Gt.prototype,"_loaded",void 0),Gt=t([dt("hcc-history-graph")],Gt);const Zt=(t,e)=>({name:t,selector:{entity:{filter:e}}});let Jt=class extends ct{constructor(){super(...arguments),this._computeLabel=t=>t.name in Nt?this._t(`show_${t.name}`):this._t(t.name)}setConfig(t){this._config=t}_t(t){return zt(this.hass,`editor.${t}`)}_schema(){return[{name:"entity",required:!0,selector:{entity:{domain:"climate"}}},{type:"grid",name:"",schema:[{name:"name",selector:{text:{}}},{name:"icon",selector:{icon:{}}}]},{name:"layout",selector:{select:{mode:"box",options:[{value:"full",label:this._t("layout_full")},{value:"compact",label:this._t("layout_compact")}]}}},{type:"expandable",name:"show",title:this._t("sections"),icon:"mdi:eye-outline",schema:[{type:"grid",name:"",schema:Object.keys(Nt).map(t=>({name:t,selector:{boolean:{}}}))}]},{type:"expandable",name:"",flatten:!0,title:this._t("sensors"),icon:"mdi:thermometer-lines",schema:[Zt("temperature_sensor",{domain:"sensor",device_class:"temperature"}),{name:"use_sensor_for_current",selector:{boolean:{}}},Zt("humidity_sensor",{domain:"sensor",device_class:"humidity"}),Zt("outdoor_sensor",{domain:["sensor","weather"]}),Zt("power_sensor",{domain:"sensor",device_class:"power"}),Zt("energy_sensor",{domain:"sensor",device_class:"energy"}),Zt("window_sensor",{domain:"binary_sensor"})]},{name:"graph_hours",selector:{number:{min:1,max:168,step:1,mode:"box",unit_of_measurement:"h"}}}]}_valueChanged(t){const e={...t.detail.value};for(const t of Object.keys(e))""!==e[t]&&null!=e[t]||delete e[t];this._config=e,this.dispatchEvent(new CustomEvent("config-changed",{detail:{config:e},bubbles:!0,composed:!0}))}render(){if(!this.hass||!this._config)return q;const t={layout:"full",graph_hours:24,...this._config,show:{...Nt,...this._config.show??{}}};return W`<ha-form .hass=${this.hass} .data=${t} .schema=${this._schema()}
      .computeLabel=${this._computeLabel} @value-changed=${this._valueChanged}></ha-form>`}};Jt.styles=n`:host { display: block; }`,t([mt({attribute:!1})],Jt.prototype,"hass",void 0),t([_t()],Jt.prototype,"_config",void 0),Jt=t([dt("ha-climate-card-editor")],Jt);const Xt=["unavailable","unknown"];console.info("%c HA-CLIMATE-CARD %c v1.0.0 ","color:#fff;background:#2196f3;font-weight:700;border-radius:4px 0 0 4px","color:#2196f3;background:#fff;font-weight:700;border-radius:0 4px 4px 0"),window.customCards=window.customCards||[],window.customCards.push({type:"ha-climate-card",name:"HA Climate Card",description:"Moderne Karte für Klimaanlagen mit Drehregler, allen Modi, Sensoren und Verlauf.",preview:!0,documentationURL:"https://github.com/passi277/HA_Climate_Card"});let Yt=class extends ct{constructor(){super(...arguments),this._expanded=!1}static getConfigElement(){return document.createElement("ha-climate-card-editor")}static getStubConfig(t){return{entity:Object.keys(t.states).find(t=>t.startsWith("climate."))??"",layout:"full"}}setConfig(t){if(!t?.entity||!t.entity.startsWith("climate."))throw new Error("ha-climate-card: 'entity' muss eine climate-Entität sein (climate.xyz)");this._config={layout:"full",graph_hours:24,...t}}getCardSize(){return"compact"===this._config?.layout?this._expanded?6:2:this._show.graph?9:7}getGridOptions(){return{columns:6,min_columns:4,rows:"auto"}}get _show(){return{...Nt,...this._config?.show??{}}}get _stateObj(){return this._config&&this.hass?.states[this._config.entity]}shouldUpdate(t){if(!t.has("hass")||t.size>1)return!0;const e=t.get("hass");if(!e||!this._config)return!0;return[this._config.entity,this._config.temperature_sensor,this._config.humidity_sensor,this._config.outdoor_sensor,this._config.power_sensor,this._config.energy_sensor,this._config.window_sensor].filter(Boolean).some(t=>e.states[t]!==this.hass.states[t])||e.locale!==this.hass.locale}updated(t){super.updated(t);const e=this._stateObj;e&&this._sentAt&&e.last_updated!==this._sentAt&&(this._sentAt=void 0,this._pending=void 0,this._pendingHumidity=void 0)}disconnectedCallback(){super.disconnectedCallback(),clearTimeout(this._tempTimer),clearTimeout(this._humTimer),clearTimeout(this._clearTimer)}_t(t){return zt(this.hass,t)}get _unit(){return this.hass?.config?.unit_system?.temperature??"°C"}_step(t){return Number(t.attributes.target_temp_step)||("°F"===this._unit?1:.5)}_fmt(t,e=.5){return null!=t&&Number.isFinite(Number(t))?Number(t).toFixed(e<1?1:0):"–"}_isDual(t){const e=t.attributes;return kt(e,gt)&&null!=e.target_temp_low&&null!=e.target_temp_high&&(null==e.temperature||!kt(e,ft))}_modeColor(t){if("off"===t.state||Xt.includes(t.state))return Tt.off;const e=Pt[t.attributes.hvac_action];return Tt[e??t.state]??"var(--primary-color)"}_isActive(t){const e=t.attributes.hvac_action;return!!e&&!["idle","off"].includes(e)&&"off"!==t.state}_currentTemp(t){const e=this._config?.temperature_sensor;if(e&&this._config?.use_sensor_for_current){const t=Number(this.hass?.states[e]?.state);if(Number.isFinite(t))return t}const i=t.attributes.current_temperature;return null==i?void 0:Number(i)}_targets(t){const e=t.attributes;return{value:this._pending?.value??(null!=e.temperature?Number(e.temperature):void 0),low:this._pending?.low??(null!=e.target_temp_low?Number(e.target_temp_low):void 0),high:this._pending?.high??(null!=e.target_temp_high?Number(e.target_temp_high):void 0)}}_sensorState(t){if(!t||!this.hass)return;const e=this.hass.states[t];if(!e)return;if(Xt.includes(e.state))return"–";if(this.hass.formatEntityState)return this.hass.formatEntityState(e);const i=e.attributes.unit_of_measurement;return i?`${e.state} ${i}`:e.state}_windowOpen(){const t=this._config?.window_sensor;return!!t&&"on"===this.hass?.states[t]?.state}_call(t,e={}){const i=this._stateObj;i&&this.hass&&(this._sentAt=i.last_updated,this.hass.callService("climate",t,{entity_id:i.entity_id,...e}).catch(t=>{console.error("ha-climate-card:",t),this._pending=void 0,this._pendingHumidity=void 0}),clearTimeout(this._clearTimer),this._clearTimer=window.setTimeout(()=>{this._pending=void 0,this._pendingHumidity=void 0,this._sentAt=void 0},6e3))}_scheduleTemp(t){clearTimeout(this._tempTimer),this._tempTimer=window.setTimeout(()=>{const t=this._stateObj,e=this._pending;t&&e&&(this._isDual(t)?this._call("set_temperature",{target_temp_low:e.low,target_temp_high:e.high}):null!=e.value&&this._call("set_temperature",{temperature:e.value}))},t)}_onDialChanging(t){clearTimeout(this._tempTimer),this._pending={...t.detail}}_onDialChanged(t){this._pending={...t.detail},this._scheduleTemp(400)}_stepTarget(t,e){const i=this._stateObj;if(!i)return;const s=this._step(i),o=Number(i.attributes.min_temp??7),r=Number(i.attributes.max_temp??35),n=this._targets(i),a=n[t]??this._currentTemp(i)??o;let l=Math.min(r,Math.max(o,Math.round((a+e*s)/s)*s));l=Number(l.toFixed(s<1?1:0)),"low"===t&&null!=n.high&&(l=Math.min(l,n.high)),"high"===t&&null!=n.low&&(l=Math.max(l,n.low)),this._pending={...n,[t]:l},this._scheduleTemp(1e3)}_stepHumidity(t){const e=this._stateObj;if(!e)return;const i=Number(e.attributes.min_humidity??30),s=Number(e.attributes.max_humidity??99),o=this._pendingHumidity??Number(e.attributes.humidity??50);this._pendingHumidity=Math.min(s,Math.max(i,o+t)),clearTimeout(this._humTimer),this._humTimer=window.setTimeout(()=>this._call("set_humidity",{humidity:this._pendingHumidity}),1e3)}_setMode(t){this._call("set_hvac_mode",{hvac_mode:t.detail.mode})}_togglePower(){const t=this._stateObj;if(!t)return;const e=t.attributes;if("off"===t.state)if(kt(e,xt))this._call("turn_on");else{const t=e.hvac_modes?.find(t=>"off"!==t);t&&this._call("set_hvac_mode",{hvac_mode:t})}else kt(e,wt)?this._call("turn_off"):this._call("set_hvac_mode",{hvac_mode:"off"})}_moreInfo(t){this.dispatchEvent(new CustomEvent("hass-more-info",{detail:{entityId:t??this._config?.entity},bubbles:!0,composed:!0}))}_renderHeader(t,e,i){const s=t.attributes.hvac_action,o=s?jt(this.hass,t,"hvac_action",s):Dt(this.hass,t,t.state),r=t.attributes.preset_mode&&"none"!==t.attributes.preset_mode?` · ${jt(this.hass,t,"preset_mode",t.attributes.preset_mode)}`:"",n=(t.attributes.hvac_modes??[]).includes("off")||kt(t.attributes,wt);return W`
      <div class="header">
        <button class="title" @click=${()=>this._moreInfo()}>
          <span class="icon-badge ${this._isActive(t)?"active":""}" style="--accent:${i}">
            <ha-icon .icon=${this._config.icon??St[s??""]??Ct[t.state]??"mdi:air-conditioner"}></ha-icon>
          </span>
          <span class="names">
            <span class="name">${e}</span>
            <span class="status">${o}${r}</span>
          </span>
        </button>
        ${n?W`
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
    </div>`}_renderDial(t,e){const i=t.attributes,s=this._step(t),o=this._isDual(t),r=this._targets(t),n=this._currentTemp(t),a="off"===t.state,l=o||null!=r.value&&kt(i,ft),c=this._config?.humidity_sensor?this.hass.states[this._config.humidity_sensor]?.state:i.current_humidity;return W`
      <hcc-climate-dial
        .min=${Number(i.min_temp??7)} .max=${Number(i.max_temp??35)} .step=${s}
        .value=${r.value} .low=${r.low} .high=${r.high} .current=${n}
        .dual=${o} .disabled=${a||!l} .color=${e} .active=${this._isActive(t)}
        @value-changing=${this._onDialChanging} @value-changed=${this._onDialChanged}>
        <div class="dial-center">
          <span class="dial-label">${a?Dt(this.hass,t,"off"):this._t("card.target")}</span>
          ${a||!l?W`<span class="dial-big">${this._fmt(n,s)}<sup>${this._unit}</sup></span>`:o?W`<span class="dial-range">
                  <span style="color:var(--state-climate-heat-color,#ff6d00)">${this._fmt(r.low,s)}</span>
                  <span class="sep">–</span>
                  <span style="color:var(--state-climate-cool-color,#2196f3)">${this._fmt(r.high,s)}</span>
                </span>`:W`<span class="dial-big">${this._fmt(r.value,s)}<sup>${this._unit}</sup></span>`}
          <span class="dial-sub">
            ${!a&&l?W`<ha-icon icon="mdi:home-thermometer-outline"></ha-icon>${this._fmt(n,s)}${this._unit}`:q}
            ${null!=c&&""!==c?W`<ha-icon icon="mdi:water-percent"></ha-icon>${Math.round(Number(c))}%`:q}
          </span>
        </div>
      </hcc-climate-dial>
      ${!a&&l?W`<div class="dial-steppers ${o?"dual":""}">
        ${o?W`${this._renderStepper("low",r.low,s,"var(--state-climate-heat-color,#ff6d00)")}
                 ${this._renderStepper("high",r.high,s,"var(--state-climate-cool-color,#2196f3)")}`:W`<button class="round" aria-label="-" @click=${()=>this._stepTarget("value",-1)}><ha-icon icon="mdi:minus"></ha-icon></button>
                 <button class="round" aria-label="+" @click=${()=>this._stepTarget("value",1)}><ha-icon icon="mdi:plus"></ha-icon></button>`}
      </div>`:q}`}_renderControls(t,e){const i=t.attributes,s=this._show,o=this.hass,r=[],n=(i.hvac_modes??[]).slice().sort((t,e)=>Et.indexOf(t)-Et.indexOf(e)).map(e=>({value:e,label:Dt(o,t,e)}));s.modes&&n.length>1&&r.push(W`<hcc-mode-bar .modes=${n} .selected=${t.state} @mode-selected=${this._setMode}></hcc-mode-bar>`);const a=(e,s,n,a,l,c,h)=>{const d=i[s];h&&kt(i,n)&&d?.length&&r.push(W`<hcc-attribute-select .label=${this._t(a)} .icon=${l} .selected=${i[e]}
        .options=${d.map(i=>({value:i,label:jt(o,t,e,i)}))}
        @option-selected=${t=>this._call(c,{[e]:t.detail.value})}>
      </hcc-attribute-select>`)};if(a("fan_mode","fan_modes",vt,"card.fan","mdi:fan","set_fan_mode",s.fan),a("swing_mode","swing_modes",$t,"card.swing","mdi:arrow-oscillating","set_swing_mode",s.swing),a("swing_horizontal_mode","swing_horizontal_modes",At,"card.swing_horizontal","mdi:arrow-left-right","set_swing_horizontal_mode",s.swing),a("preset_mode","preset_modes",bt,"card.preset","mdi:star-outline","set_preset_mode",s.presets),s.humidity&&kt(i,yt)&&null!=i.humidity){const t=this._pendingHumidity??Number(i.humidity);r.push(W`<div class="humidity-row">
        <span class="row-label"><ha-icon icon="mdi:water-percent"></ha-icon>${this._t("card.target_humidity")}</span>
        <div class="stepper">
          <button aria-label="-" @click=${()=>this._stepHumidity(-1)}><ha-icon icon="mdi:minus"></ha-icon></button>
          <span class="stepper-value">${t}<small>%</small></span>
          <button aria-label="+" @click=${()=>this._stepHumidity(1)}><ha-icon icon="mdi:plus"></ha-icon></button>
        </div>
      </div>`)}if(s.sensors){const e=this._sensorItems(t);e.length&&r.push(W`<hcc-sensor-row .items=${e}></hcc-sensor-row>`)}return s.graph&&r.push(W`<div class="graph-wrap">
        <span class="row-label"><ha-icon icon="mdi:chart-line"></ha-icon>${this._t("card.history")}</span>
        <hcc-history-graph .hass=${o} .entity=${t.entity_id}
          .sensor=${this._config.use_sensor_for_current?this._config.temperature_sensor:void 0}
          .hours=${this._config.graph_hours??24} .unit=${this._unit} .emptyText=${this._t("card.no_history")}
          style="--hcc-accent:${e}"></hcc-history-graph>
      </div>`),W`<div class="controls" style="--hcc-accent:${e}">${r}</div>`}_sensorItems(t){const e=this._config,i=[],s=(t,e,s,o=!1)=>{const r=this._sensorState(t);null!=r&&i.push({entity:t,icon:e,label:this._t(s),value:r,warning:o})};if(e.use_sensor_for_current||s(e.temperature_sensor,"mdi:home-thermometer-outline","card.current"),null==e.humidity_sensor&&null!=t.attributes.current_humidity&&"compact"===this._config?.layout&&i.push({icon:"mdi:water-percent",label:this._t("card.humidity"),value:`${t.attributes.current_humidity}%`}),"compact"===this._config?.layout&&s(e.humidity_sensor,"mdi:water-percent","card.humidity"),s(e.outdoor_sensor,"mdi:thermometer","card.outdoor"),s(e.power_sensor,"mdi:flash","card.power"),s(e.energy_sensor,"mdi:lightning-bolt","card.energy"),e.window_sensor&&this.hass.states[e.window_sensor]){const t=this._windowOpen();i.push({entity:e.window_sensor,icon:t?"mdi:window-open-variant":"mdi:window-closed-variant",label:this.hass.states[e.window_sensor].attributes.friendly_name??"Window",value:this._sensorState(e.window_sensor)??"",warning:t})}return i}_renderCompact(t,e,i){const s=this._step(t),o=this._isDual(t),r=this._targets(t),n="off"===t.state,a=o||null!=r.value&&kt(t.attributes,ft),l=this._currentTemp(t);return W`
      <div class="compact-top">
        ${this._renderHeader(t,e,i)}
      </div>
      <div class="compact-row">
        <div class="compact-current">
          <span class="big">${this._fmt(l,s)}<sup>${this._unit}</sup></span>
          <span class="dial-label">${this._t("card.current")}</span>
        </div>
        ${!n&&a?o?W`<div class="compact-steppers">
                ${this._renderStepper("low",r.low,s,"var(--state-climate-heat-color,#ff6d00)")}
                ${this._renderStepper("high",r.high,s,"var(--state-climate-cool-color,#2196f3)")}
              </div>`:this._renderStepper("value",r.value,s,i):q}
      </div>
      ${this._renderWindowWarning()}
      <button class="expand" @click=${()=>{this._expanded=!this._expanded}} aria-expanded=${this._expanded}>
        <span>${this._t(this._expanded?"card.less":"card.more")}</span>
        <ha-icon icon=${this._expanded?"mdi:chevron-up":"mdi:chevron-down"}></ha-icon>
      </button>
      ${this._expanded?this._renderControls(t,i):q}`}render(){if(!this._config||!this.hass)return q;const t=this._stateObj;if(!t)return W`<ha-card><div class="warning">${this._t("card.entity_not_found")}: ${this._config.entity}</div></ha-card>`;const e=this._config.name??t.attributes.friendly_name??t.entity_id;if(Xt.includes(t.state))return W`<ha-card class="unavailable">
        ${this._renderHeader(t,e,Tt.off)}
        <div class="warning">${this._t("card.unavailable")}</div>
      </ha-card>`;const i=this._modeColor(t),s="compact"===this._config.layout;return W`<ha-card class=${s?"compact":"full"} style="--accent:${i}">
      <div class="glow"></div>
      ${s?this._renderCompact(t,e,i):W`
          ${this._renderHeader(t,e,i)}
          ${this._renderWindowWarning()}
          ${this._renderDial(t,i)}
          ${this._renderControls(t,i)}`}
    </ha-card>`}};Yt.styles=Rt,t([mt({attribute:!1})],Yt.prototype,"hass",void 0),t([_t()],Yt.prototype,"_config",void 0),t([_t()],Yt.prototype,"_pending",void 0),t([_t()],Yt.prototype,"_pendingHumidity",void 0),t([_t()],Yt.prototype,"_expanded",void 0),Yt=t([dt("ha-climate-card")],Yt);export{Yt as HaClimateCard};
