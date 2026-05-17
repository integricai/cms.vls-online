import type { HeaderConfig } from '../../types/cms';
import { generateHeaderHtml } from '../Header/generateHtml';

export function generateBlogHeaderHtml(cfg: HeaderConfig): string {
  const base = generateHeaderHtml(cfg)
    .replace('.block.parrot.zenstyle.headers{display:none!important;}\n', '')
    .replace(/class="(vlsh[^"]*-wrap)"/, 'class="$1 vls-blog-header-generated"');
  const cleanup = `<style>
html body .zbv-blog-05.block.hero,
html body .zbv-blog-05[data-uniqid],
html body #zen_blog_post,
html body [data-zd="zen_blog_post"]{
  display:none!important;
  visibility:hidden!important;
  height:0!important;
  min-height:0!important;
  max-height:0!important;
  margin:0!important;
  padding:0!important;
  border:0!important;
  overflow:hidden!important;
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
</style>`;
  const script = `<script data-cfasync="false">(function(){
function forceHide(target){
  if(!target)return;
    target.style.setProperty('display','none','important');
    target.style.setProperty('visibility','hidden','important');
    target.style.setProperty('height','0','important');
    target.style.setProperty('min-height','0','important');
    target.style.setProperty('max-height','0','important');
    target.style.setProperty('margin','0','important');
    target.style.setProperty('padding','0','important');
    target.style.setProperty('border','0','important');
    target.style.setProperty('overflow','hidden','important');
}
function hasGeneratedContent(target){
  return !!(target && target.querySelector && target.querySelector('.vls-blog-header-generated,.vlsft-grid,.vls-blog'));
}
function hideZenBlogPost(){
  document.querySelectorAll('#header5,[data-zen="zen_header_dynamic"],.block.parrot.zenstyle.headers,.zbv-blog-05.block.hero,.zbv-blog-05[data-uniqid],#zen_blog_post,[data-zd="zen_blog_post"]').forEach(function(el){
    var target=el.id==='zen_blog_post'||el.getAttribute('data-zd')==='zen_blog_post' ? el.closest('.zbv-blog-05.block.hero') || el : el;
    if(hasGeneratedContent(target))return;
    if(target.matches && target.matches('.block.parrot.zenstyle.headers') && !target.querySelector('.zbv-blog-nav'))return;
    forceHide(target);
  });
}
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
function run(){hideZenBlogPost();cleanMenuDots();preferHeaderZenMenu();}
if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',run);}else{run();}
setTimeout(run,300);setTimeout(run,1000);setTimeout(run,2500);
new MutationObserver(run).observe(document.body,{childList:true,subtree:true});
})();<\/script>`;
  return `${cleanup}\n${base}\n${script}`;
}
