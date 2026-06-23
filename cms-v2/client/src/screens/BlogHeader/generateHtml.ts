import type { HeaderConfig } from '../../types/cms';
import { generateHeaderHtml } from '../Header/generateHtml';

export function generateBlogHeaderHtml(cfg: HeaderConfig): string {
  const base = generateHeaderHtml({ ...cfg, useZenMenu: true, liveApiUrl: false } as HeaderConfig & { liveApiUrl: false })
    .replace('.block.parrot.zenstyle.headers{display:none!important;}\n', '')
    .replace('.block.parrot.zenstyle.headers[data-zen="zen_header_dynamic"]{display:none!important;}\n', '')
    .replace('<script type="module" data-cfasync="false">', '<script data-cfasync="false">')
    .replace(/class="(vlsh[^"]*-wrap)"/, 'class="$1 vls-blog-header-generated"');
  const cleanup = `<style>
html body .vls-zen-hidden{display:none!important;visibility:hidden!important;height:0!important;min-height:0!important;max-height:0!important;margin:0!important;padding:0!important;border:0!important;overflow:hidden!important;}
html body .vls-zen-hidden,html body .vls-zen-hidden *{pointer-events:none!important;}
html body .vls-blog-header-generated{background:#fff!important;position:relative!important;z-index:100000!important;pointer-events:auto!important;}
html body .vls-blog-header-generated a,
html body .vls-blog-header-generated button,
html body .vls-blog-header-generated nav,
html body .vls-blog-header-generated ul,
html body .vls-blog-header-generated li{pointer-events:auto!important;}
html body .vls-blog-header-generated [class$="-brand"]{padding-top:0!important;padding-bottom:4px!important;}
html body .vls-blog-header-generated [class$="-brand-inner"],
html body .vls-blog-header-generated [class$="-menu-inner"]{max-width:1120px!important;}
html body .vls-blog-header-generated [class$="-menubar"]{min-height:0!important;}
html body .vls-blog-header-generated [class$="-menu-inner"]{min-height:0!important;}
html body .vls-blog-header-generated [class$="-nl"]{padding-top:7px!important;padding-bottom:7px!important;line-height:1.2!important;}
@media(min-width:769px){
  html body .vls-blog-header-generated [class$="-nav"]{display:block!important;}
  html body .vls-blog-header-generated [class$="-ul"]{display:flex!important;}
}
@media(max-width:768px){
  html body .vls-blog-header-generated [class$="-nav"]:not([class*="-open"]){display:none!important;}
  html body .vls-blog-header-generated [class$="-nav"][class*="-open"]{display:block!important;}
  html body .vls-blog-header-generated [class$="-ul"]{display:flex!important;flex-direction:column!important;align-items:stretch!important;}
  html body .vls-blog-header-generated [class$="-nl"]{padding-top:8px!important;padding-bottom:8px!important;}
}
html body .zbv-blog-nav,
html body .zbv-blog-nav ul,
html body .zbv-blog-nav li,
html body .vls-blog-header-no-dots,
html body .vls-blog-header-no-dots ul,
html body .vls-blog-header-no-dots li{list-style:none!important;}
html body .zbv-blog-nav li:before,
html body .zbv-blog-nav li:after,
html body .vls-blog-header-no-dots li:before,
html body .vls-blog-header-no-dots li:after{content:none!important;display:none!important;}
html body #zen_blog_post:has(.vls-blog)>nav,html body #zen_blog_post:has(.vls-blog)>ol.breadcrumb,html body #zen_blog_post:has(.vls-blog)>h1,html body #zen_blog_post:has(.vls-blog)>.blog-heading,html body #zen_blog_post:has(.vls-blog)>.zbv-blog-05-user,html body #zen_blog_post:has(.vls-blog)>img,html body #zen_blog_post:has(.vls-blog)>.zbv-blog-05-img,html body #zen_blog_post:has(.vls-blog)>p.zbv-blog-05-tag,html body #zen_blog_post:has(.vls-blog)>p.dynamic-text:not(.blog-content),html body .blog-content:has(.vls-blog)>p.dynamic-text:not(:has(.vls-blog-header-generated)),html body .blog-content:has(.vls-blog)>p.dynamic-text:has(style),html body .blog-content:has(.vls-blog)>p:empty,html body .blog-content:has(.vls-blog)>p.zbv-blog-05-tag{display:none!important;visibility:hidden!important;height:0!important;min-height:0!important;max-height:0!important;margin:0!important;padding:0!important;border:0!important;overflow:hidden!important;pointer-events:none!important;}
html body .zbv-blog-05:has(.vls-blog){min-height:0!important;padding-top:0!important;background-image:none!important;background-color:transparent!important;}
html body .zbv-blog-05:has(.vls-blog)>.overly{display:none!important;}
html body #zen_blog_post:has(.vls-blog){padding-top:0!important;margin-top:0!important;}
</style>`;
  const beforeHeaderScript = `<script data-cfasync="false">(function(){
function snapshotZenlerMenu(){
  if(document.getElementById('vls-blog-zen-menu-source'))return;
  var menu=document.querySelector('.block.parrot.zenstyle.headers ul.dynamic_menu_texts,.zbv-blog-nav ul.dynamic_menu_texts');
  if(!menu)return;
  var holder=document.createElement('div');
  holder.id='vls-blog-zen-menu-source';
  holder.style.setProperty('display','none','important');
  holder.setAttribute('aria-hidden','true');
  holder.appendChild(menu.cloneNode(true));
  document.body.appendChild(holder);
}
snapshotZenlerMenu();
})();<\/script>`;
  const script = `<script data-cfasync="false">(function(){
function hideNode(el){
  if(!el)return;
  el.classList.add('vls-zen-hidden');
  el.style.setProperty('display','none','important');
  el.style.setProperty('visibility','hidden','important');
  el.style.setProperty('height','0','important');
  el.style.setProperty('min-height','0','important');
  el.style.setProperty('max-height','0','important');
  el.style.setProperty('margin','0','important');
  el.style.setProperty('padding','0','important');
  el.style.setProperty('border','0','important');
  el.style.setProperty('overflow','hidden','important');
  el.style.setProperty('pointer-events','none','important');
}
function hideOldZenlerHeader(){
  document.querySelectorAll('#header5,[data-zen="zen_header_dynamic"],.block.parrot.zenstyle.headers[data-zen="zen_header_dynamic"]').forEach(function(el){
    if(el.querySelector('.vls-blog-header-generated'))return;
    hideNode(el);
  });
}
function hasCmsBlog(){
  return !!document.querySelector('.vls-blog,.blog-content .vls-blog,#zen_blog_post .vls-blog');
}
function isCmsKeep(el){
  if(!el||!el.matches)return false;
  if(el.matches('script,style,link,meta'))return true;
  if(el.matches('.vls-blog-header-generated,.vls-blog,.vlsft-generated,p.blog-content,.blog-content'))return true;
  if(el.querySelector&&el.querySelector('.vls-blog-header-generated,.vls-blog,.vlsft-generated'))return true;
  return false;
}
function hideZenlerBlogChrome(){
  if(!hasCmsBlog())return;
  document.querySelectorAll('#zen_blog_post nav,#zen_blog_post>.blog-heading,#zen_blog_post>h1,#zen_blog_post>.zbv-blog-05-user,#zen_blog_post>img.zbv-blog-05-img,#zen_blog_post>p.zbv-blog-05-tag,#zen_blog_post>p.dynamic-text:not(.blog-content)').forEach(hideNode);
  var holder=document.querySelector('#zen_blog_post,[data-zd="zen_blog_post"]');
  if(holder){
    Array.prototype.slice.call(holder.children).forEach(function(child){
      if(!isCmsKeep(child))hideNode(child);
    });
  }
  document.querySelectorAll('.blog-content p.dynamic-text,#zen_blog_post>p.dynamic-text').forEach(function(p){
    if(p.matches('.blog-content'))return;
    if(p.querySelector('.vls-blog-header-generated,.vls-blog'))return;
    if(p.querySelector('style')&&!p.querySelector('.vls-blog')){hideNode(p);return;}
    if(p.closest('#zen_blog_post')&&p.matches('p.dynamic-text')&&!p.matches('.blog-content'))hideNode(p);
  });
  document.querySelectorAll('.blog-content p:empty,.blog-content p.zbv-blog-05-tag').forEach(hideNode);
}
function hideZenBlogIntro(){hideZenlerBlogChrome();}
function cleanMenuDots(){
  document.querySelectorAll('.zbv-blog-nav ul,ul.dynamic_menu_texts,ul[class*="-ul"],ul[class*="-drop"]').forEach(function(ul){
    ul.classList.add('vls-blog-header-no-dots');
    ul.style.setProperty('list-style','none','important');
    ul.style.setProperty('padding-left','0','important');
    ul.style.setProperty('margin-left','0','important');
  });
  document.querySelectorAll('.zbv-blog-nav li,ul.dynamic_menu_texts li,ul[class*="-ul"] li,ul[class*="-drop"] li').forEach(function(li){
    li.style.setProperty('list-style','none','important');
    li.style.setProperty('list-style-type','none','important');
  });
}
function preferHeaderZenMenu(){
  var headerMenu=document.querySelector('.block.parrot.zenstyle.headers ul.dynamic_menu_texts,.zbv-blog-nav ul.dynamic_menu_texts');
  if(!headerMenu)return;
  document.querySelectorAll('ul.dynamic_menu_texts').forEach(function(ul){
    if(ul!==headerMenu && !ul.closest('.block.parrot.zenstyle.headers') && !ul.closest('.zbv-blog-nav')){
      ul.setAttribute('data-vls-ignore-menu','1');
    }
  });
}
function run(){hideOldZenlerHeader();hideZenBlogIntro();cleanMenuDots();preferHeaderZenMenu();}
if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',run);}else{run();}
setTimeout(run,300);setTimeout(run,1000);setTimeout(run,2500);
new MutationObserver(run).observe(document.body,{childList:true,subtree:true});
})();<\/script>`;
  return `${cleanup}\n${beforeHeaderScript}\n${base}\n${script}`;
}
