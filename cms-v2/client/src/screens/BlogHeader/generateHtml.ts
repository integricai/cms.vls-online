import type { HeaderConfig } from '../../types/cms';
import { generateHeaderHtml } from '../Header/generateHtml';

export function generateBlogHeaderHtml(cfg: HeaderConfig): string {
  const base = generateHeaderHtml(cfg)
    .replace('.block.parrot.zenstyle.headers{display:none!important;}\n', '')
    .replace(/class="(vlsh[^"]*-wrap)"/, 'class="$1 vls-blog-header-generated"');
  const cleanup = `<style>
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
</style>`;
  const script = `<script data-cfasync="false">(function(){
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
function run(){cleanMenuDots();preferHeaderZenMenu();}
if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',run);}else{run();}
setTimeout(run,300);setTimeout(run,1000);setTimeout(run,2500);
new MutationObserver(run).observe(document.body,{childList:true,subtree:true});
})();<\/script>`;
  return `${cleanup}\n${base}\n${script}`;
}
