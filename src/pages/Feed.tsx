import { useEffect,useMemo,useRef,useState,type ChangeEvent,type FormEvent } from 'react';
import { Camera,ImagePlus,Plus,Star,Trash2,X } from 'lucide-react';
import type { FeedPost,Membership } from '../../shared/domain';
import { api,supabase } from '../lib/api';
import { optimizeImage } from '../lib/images';
import { Empty,Modal,PageTitle } from '../components/ui';
import type { WorkspaceProps } from './Workspace';
import {useI18n} from '../i18n';

const MAX_IMAGE_BYTES=15*1024*1024;
const ALLOWED_TYPES=new Set(['image/jpeg','image/png','image/webp']);

type PublicReview={
 id:string;
 rating:number;
 comment:string|null;
 created_at:string;
};

type ProfessionalFeedStats={
 barber_id:string;
 rating_average:number;
 review_count:number;
 completed_count:number;
 reviews:PublicReview[];
};

type ReviewSort='recent'|'highest'|'lowest';

const relative=(iso:string,locale:string)=>{
 const diff=Math.max(0,Date.now()-new Date(iso).getTime());
 const rtf=new Intl.RelativeTimeFormat(locale==='en'?'en-US':locale,{numeric:'auto'});
 const minutes=Math.floor(diff/60000);
 if(minutes<1)return rtf.format(0,'minute');
 if(minutes<60)return rtf.format(-minutes,'minute');
 const hours=Math.floor(minutes/60);
 if(hours<24)return rtf.format(-hours,'hour');
 const days=Math.floor(hours/24);
 return rtf.format(-days,'day');
};

const initials=(name:string)=>
 name.split(' ').filter(Boolean).map(value=>value[0]).slice(0,2).join('').toUpperCase();

function RatingStars({value,size=14}:{value:number;size?:number}){
 return <span className="feed-stars" aria-label={`${value.toFixed(1)} de 5`}>
  {[1,2,3,4,5].map(star=>
   <Star
    key={star}
    size={size}
    fill={star<=Math.round(value)?'currentColor':'none'}
   />
  )}
 </span>;
}

export function Feed(p:WorkspaceProps){
 const {t,locale}=useI18n();
 const {data}=p;

 const canPost=
  data.membership.role==='OWNER'||
  data.membership.role==='BARBER';

 const [composer,setComposer]=useState(false);
 const [urls,setUrls]=useState<Record<string,string>>({});
 const [removing,setRemoving]=useState<string|null>(null);
 const [profileId,setProfileId]=useState<string|null>(null);
 const [profileStats,setProfileStats]=useState<ProfessionalFeedStats[]>([]);
 const [statsLoading,setStatsLoading]=useState(false);

 const professionals=useMemo(
  ()=>data.team.filter(member=>
   member.active&&(
    member.role==='BARBER'||
    (
     data.shop.operation_mode==='SOLO'&&
     member.role==='OWNER'
    )
   )
  ),
  [data.team,data.shop.operation_mode]
 );

 const statsByProfessional=useMemo(
  ()=>new Map(profileStats.map(item=>[item.barber_id,item])),
  [profileStats]
 );

 useEffect(()=>{
  let alive=true;
  const local:Record<string,string>={};

  const run=async()=>{
   if(p.demo){
    for(const post of data.posts)local[post.id]=post.image_path;
    if(alive)setUrls(local);
    return;
   }

   const storageClient=supabase;
   if(!storageClient)return;

   await Promise.all(
    data.posts.map(async post=>{
     const {data:signed}=await storageClient.storage
      .from('feed-posts')
      .createSignedUrl(post.image_path,3600);

     if(signed?.signedUrl)local[post.id]=signed.signedUrl;
    })
   );

   if(alive)setUrls(local);
  };

  void run();

  return()=>{alive=false;};
 },[data.posts,p.demo]);

 useEffect(()=>{
  let alive=true;

  if(p.demo){
   const demoStats=professionals.map(member=>{
    const reviews=data.reviews.filter(review=>
     review.barber_id===member.user_id
    );

    const average=reviews.length
     ?reviews.reduce((sum,review)=>sum+review.rating,0)/reviews.length
     :0;

    return {
     barber_id:member.user_id,
     rating_average:average,
     review_count:reviews.length,
     completed_count:data.appointments.filter(appointment=>
      appointment.barber_id===member.user_id&&
      appointment.status==='completed'
     ).length,
     reviews:reviews.map(review=>({
      id:review.id,
      rating:review.rating,
      comment:review.comment??null,
      created_at:review.created_at
     }))
    };
   });

   setProfileStats(demoStats);
   return;
  }

  setStatsLoading(true);

  void api<ProfessionalFeedStats[]>(
   '/feed/professionals',
   data.shop.id
  )
  .then(rows=>{
   if(alive)setProfileStats(rows);
  })
  .catch(()=>{
   if(alive)setProfileStats([]);
  })
  .finally(()=>{
   if(alive)setStatsLoading(false);
  });

  return()=>{alive=false;};
 },[
  data.shop.id,
  data.reviews,
  data.appointments,
  professionals,
  p.demo
 ]);

 async function remove(post:FeedPost){
  if(!confirm(t('feed.removeConfirm')))return;

  setRemoving(post.id);

  try{
   if(p.demo){
    p.updateDemo(d=>({
     ...d,
     posts:d.posts.filter(item=>item.id!==post.id)
    }));
   }else{
    await api(
     `/posts/${post.id}`,
     data.shop.id,
     undefined,
     'DELETE'
    );

    await supabase?.storage
     .from('feed-posts')
     .remove([post.image_path]);

    await p.refresh();
   }

   p.notify(t('feed.removed'));
  }catch(error){
   p.notify((error as Error).message);
  }finally{
   setRemoving(null);
  }
 }

 const selectedProfessional=
  professionals.find(member=>member.user_id===profileId)??null;

 const selectedStats=
  profileId?statsByProfessional.get(profileId):undefined;

 const selectedPosts=
  profileId
   ?data.posts.filter(post=>post.author_id===profileId)
   :[];

 return <>
  <PageTitle
   eyebrow={t('feed.eyebrow')}
   title={t('feed.title')}
   description={t('feed.desc')}
   action={
    canPost?
     <button className="primary" onClick={()=>setComposer(true)}>
      <Plus size={18}/>
      {t('feed.new')}
     </button>
     :
     undefined
   }
  />

  {professionals.length>0&&
   <section
    className="feed-professional-strip"
    aria-label={t('feed.professionals')}
   >
    <div className="feed-section-heading">
     <div>
      <span>{t('feed.professionalEyebrow')}</span>
      <h2>{t('feed.professionals')}</h2>
     </div>

     <small>{t('feed.professionalHint')}</small>
    </div>

    <div className="feed-professional-scroll">
     {professionals.map(member=>{
      const stats=statsByProfessional.get(member.user_id);
      const average=Number(stats?.rating_average??0);

      return <button
       type="button"
       className="feed-professional-chip"
       key={member.user_id}
       onClick={()=>setProfileId(member.user_id)}
       aria-label={t('feed.openProfessional',{name:member.display_name})}
      >
       <span className="feed-professional-avatar">
        {member.avatar_url?
         <img src={member.avatar_url} alt=""/>
         :
         initials(member.display_name)
        }
       </span>

       <strong>{member.display_name.split(' ')[0]}</strong>

       <span className="feed-professional-rating">
        <Star size={12} fill="currentColor"/>
        {statsLoading
         ?'—'
         :average>0
          ?new Intl.NumberFormat(
           locale==='en'?'en-US':locale,
           {minimumFractionDigits:2,maximumFractionDigits:2}
          ).format(average)
          :t('feed.ratingNew')
        }
       </span>
      </button>;
     })}
    </div>
   </section>
  }

  {data.posts.length?
   <section className="feed-showcase" aria-label={t('feed.latestWork')}>
    {data.posts.map(post=>{
     const canDelete=
      canPost&&(
       data.membership.role==='OWNER'||
       post.author_id===data.membership.user_id
      );

     const author=
      professionals.find(member=>member.user_id===post.author_id);

     return <article
      className="feed-card feed-showcase-card"
      key={post.id}
     >
      <div className="feed-image-wrap">
       {urls[post.id]?
        <img
         src={urls[post.id]}
         alt={t('feed.imageAlt',{name:post.author_name})}
        />
        :
        <div className="feed-image-loading fio-pattern-dark">
         <Camera size={28}/>
        </div>
       }

       <div className="feed-image-gradient"/>

       <button
        type="button"
        className="feed-card-author"
        onClick={()=>author&&setProfileId(author.user_id)}
        disabled={!author}
       >
        <span className="feed-card-avatar">
         {author?.avatar_url?
          <img src={author.avatar_url} alt=""/>
          :
          initials(post.author_name)
         }
        </span>

        <span>
         <strong>{post.author_name}</strong>
         <small>{relative(post.created_at,locale)}</small>
        </span>
       </button>

       {canDelete&&
        <button
         className="feed-delete"
         aria-label={t('feed.removeAria')}
         disabled={removing===post.id}
         onClick={()=>void remove(post)}
        >
         <Trash2 size={16}/>
        </button>
       }
      </div>

      {post.caption&&
       <div className="feed-card-body">
        <p>{post.caption}</p>
       </div>
      }
     </article>;
    })}
   </section>
   :
   <Empty title={t('feed.emptyTitle')}>
    {canPost?t('feed.emptyStaff'):t('feed.emptyClient')}
   </Empty>
  }

  {selectedProfessional&&
   <ProfessionalFeedProfile
    member={selectedProfessional}
    stats={selectedStats}
    posts={selectedPosts}
    urls={urls}
    onClose={()=>setProfileId(null)}
   />
  }

  {composer&&
   <PostComposer
    {...p}
    onClose={()=>setComposer(false)}
   />
  }
 </>;
}

function ProfessionalFeedProfile(p:{
 member:Membership;
 stats?:ProfessionalFeedStats;
 posts:FeedPost[];
 urls:Record<string,string>;
 onClose:()=>void;
}){
 const {t,locale}=useI18n();

 const [tab,setTab]=useState<'feed'|'reviews'>('feed');
 const [ratingFilter,setRatingFilter]=useState(0);
 const [sort,setSort]=useState<ReviewSort>('recent');

 const reviews=p.stats?.reviews??[];
 const average=Number(p.stats?.rating_average??0);
 const reviewCount=Number(p.stats?.review_count??0);
 const completedCount=Number(p.stats?.completed_count??0);

 const heroPost=p.posts.find(post=>p.urls[post.id]);
 const heroUrl=
  p.member.avatar_url||
  (heroPost?p.urls[heroPost.id]:'')||
  '';

 const filteredReviews=useMemo(()=>{
  const next=reviews
   .filter(review=>
    ratingFilter===0||
    review.rating===ratingFilter
   )
   .slice();

  if(sort==='highest'){
   next.sort((a,b)=>
    b.rating-a.rating||
    Date.parse(b.created_at)-Date.parse(a.created_at)
   );
  }else if(sort==='lowest'){
   next.sort((a,b)=>
    a.rating-b.rating||
    Date.parse(b.created_at)-Date.parse(a.created_at)
   );
  }else{
   next.sort((a,b)=>
    Date.parse(b.created_at)-Date.parse(a.created_at)
   );
  }

  return next;
 },[reviews,ratingFilter,sort]);

 const distribution=(rating:number)=>
  reviews.length
   ?reviews.filter(review=>review.rating===rating).length/reviews.length*100
   :0;

 return <div
  className="feed-profile-backdrop"
  role="presentation"
  onMouseDown={event=>{
   if(event.target===event.currentTarget)p.onClose();
  }}
 >
  <section
   className="feed-profile-panel"
   role="dialog"
   aria-modal="true"
   aria-label={p.member.display_name}
  >
   <button
    type="button"
    className="feed-profile-close"
    onClick={p.onClose}
    aria-label={t('public.close')}
   >
    <X size={24}/>
   </button>

   <div className="feed-profile-hero">
    {heroUrl?
     <img src={heroUrl} alt=""/>
     :
     <div className="feed-profile-hero-placeholder fio-pattern-dark">
      <span>{initials(p.member.display_name)}</span>
     </div>
    }

    <div className="feed-profile-hero-fade"/>
   </div>

   <div className="feed-profile-content">
    <div className="feed-profile-head">
     <span className="feed-profile-avatar">
      {p.member.avatar_url?
       <img src={p.member.avatar_url} alt=""/>
       :
       initials(p.member.display_name)
      }
     </span>

     <div className="feed-profile-name">
      <h2>{p.member.display_name}</h2>

      <div className="feed-profile-rating-line">
       <RatingStars value={average} size={15}/>

       <strong>
        {average>0
         ?new Intl.NumberFormat(
          locale==='en'?'en-US':locale,
          {minimumFractionDigits:2,maximumFractionDigits:2}
         ).format(average)
         :'—'
        }
       </strong>

       <span>·</span>
       <small>{reviewCount} {t('feed.reviewCount')}</small>
      </div>
     </div>
    </div>

    <div className="feed-profile-stats">
     <div>
      <strong>{completedCount}</strong>
      <span>{t('feed.completed')}</span>
     </div>

     <div>
      <strong>{reviewCount}</strong>
      <span>{t('feed.reviewCount')}</span>
     </div>

     <div>
      <strong>{p.posts.length}</strong>
      <span>{t('feed.posts')}</span>
     </div>
    </div>

    <nav
     className="feed-profile-tabs"
     aria-label={t('feed.profileTabs')}
    >
     <button
      type="button"
      className={tab==='feed'?'active':''}
      onClick={()=>setTab('feed')}
     >
      {t('feed.profileFeed')}
     </button>

     <button
      type="button"
      className={tab==='reviews'?'active':''}
      onClick={()=>setTab('reviews')}
     >
      {t('feed.profileReviews')}
     </button>
    </nav>

    {tab==='feed'?
     <section className="feed-profile-posts">
      {p.posts.length?
       p.posts.map(post=>
        <article key={post.id} className="feed-profile-post">
         <div>
          {p.urls[post.id]?
           <img src={p.urls[post.id]} alt=""/>
           :
           <div className="feed-image-loading fio-pattern-dark">
            <Camera size={24}/>
           </div>
          }
         </div>

         {post.caption&&<p>{post.caption}</p>}
         <small>{relative(post.created_at,locale)}</small>
        </article>
       )
       :
       <div className="feed-profile-empty">
        <Camera size={24}/>
        <strong>{t('feed.postsEmpty')}</strong>
       </div>
      }
     </section>
     :
     <section className="feed-reviews-panel">
      <div className="feed-rating-summary">
       <div className="feed-rating-score">
        <strong>
         {average>0
          ?new Intl.NumberFormat(
           locale==='en'?'en-US':locale,
           {minimumFractionDigits:2,maximumFractionDigits:2}
          ).format(average)
          :'—'
         }
        </strong>

        <RatingStars value={average} size={16}/>

        <span>{reviewCount} {t('feed.reviewCount')}</span>
       </div>

       <div className="feed-rating-bars">
        {[5,4,3,2,1].map(rating=>
         <div key={rating}>
          <span>{rating}</span>
          <Star size={11} fill="currentColor"/>
          <i>
           <b style={{width:`${distribution(rating)}%`}}/>
          </i>
         </div>
        )}
       </div>
      </div>

      <div className="feed-review-toolbar">
       <div
        className="feed-review-filters"
        aria-label={t('feed.reviewFilterLabel')}
       >
        <button
         type="button"
         className={ratingFilter===0?'active':''}
         onClick={()=>setRatingFilter(0)}
        >
         {t('feed.filterAll')}
        </button>

        {[5,4,3,2,1].map(rating=>
         <button
          type="button"
          key={rating}
          className={ratingFilter===rating?'active':''}
          onClick={()=>setRatingFilter(rating)}
         >
          {rating}
          <Star size={11} fill="currentColor"/>
         </button>
        )}
       </div>

       <select
        value={sort}
        onChange={event=>setSort(event.target.value as ReviewSort)}
        aria-label={t('feed.sortReviews')}
       >
        <option value="recent">{t('feed.sortRecent')}</option>
        <option value="highest">{t('feed.sortHighest')}</option>
        <option value="lowest">{t('feed.sortLowest')}</option>
       </select>
      </div>

      <div className="feed-review-list">
       {filteredReviews.length?
        filteredReviews.map(review=>
         <article className="feed-review-card" key={review.id}>
          <div className="feed-review-head">
           <span className="feed-review-client">✓</span>

           <div>
            <strong>{t('feed.verifiedClient')}</strong>
            <small>{relative(review.created_at,locale)}</small>
           </div>

           <RatingStars value={review.rating} size={13}/>
          </div>

          {review.comment?
           <p>{review.comment}</p>
           :
           <p className="muted">{t('feed.noReviewComment')}</p>
          }
         </article>
        )
        :
        <div className="feed-profile-empty">
         <Star size={24}/>
         <strong>{t('feed.reviewsEmpty')}</strong>
        </div>
       }
      </div>
     </section>
    }
   </div>
  </section>
 </div>;
}

function PostComposer(p:WorkspaceProps&{onClose:()=>void}){
 const {t}=useI18n();

 const input=useRef<HTMLInputElement>(null);
 const [file,setFile]=useState<File|null>(null);
 const [preview,setPreview]=useState('');
 const [caption,setCaption]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');

 useEffect(
  ()=>()=>{
   if(preview.startsWith('blob:'))URL.revokeObjectURL(preview);
  },
  [preview]
 );

 function choose(event:ChangeEvent<HTMLInputElement>){
  const next=event.target.files?.[0]??null;
  setError('');

  if(!next)return;

  if(!ALLOWED_TYPES.has(next.type)){
   setError(t('feed.invalidType'));
   return;
  }

  if(next.size>MAX_IMAGE_BYTES){
   setError(t('feed.tooLarge'));
   return;
  }

  if(preview.startsWith('blob:'))URL.revokeObjectURL(preview);

  setFile(next);
  setPreview(URL.createObjectURL(next));
 }

 async function submit(event:FormEvent){
  event.preventDefault();

  if(!file){
   setError(t('feed.chooseRequired'));
   return;
  }

  setBusy(true);
  setError('');

  let uploadedPath='';

  try{
   if(p.demo){
    p.updateDemo(d=>({
     ...d,
     posts:[
      {
       id:crypto.randomUUID(),
       author_id:d.membership.user_id,
       author_name:d.membership.display_name,
       caption:caption.trim(),
       image_path:preview,
       created_at:new Date().toISOString()
      },
      ...d.posts
     ]
    }));
   }else{
    if(!supabase)throw new Error(t('feed.supabaseMissing'));

    const optimized=await optimizeImage(file,'feed');

    uploadedPath=
     `${p.data.shop.id}/${p.data.membership.user_id}/${crypto.randomUUID()}.webp`;

    const upload=await supabase.storage
     .from('feed-posts')
     .upload(
      uploadedPath,
      optimized,
      {
       cacheControl:'31536000',
       contentType:'image/webp',
       upsert:false
      }
     );

    if(upload.error)throw new Error(t('feed.uploadFailed'));

    try{
     await api(
      '/posts',
      p.data.shop.id,
      {
       caption:caption.trim(),
       imagePath:uploadedPath
      }
     );
    }catch(error){
     await supabase.storage
      .from('feed-posts')
      .remove([uploadedPath]);

     throw error;
    }

    await p.refresh();
   }

   p.notify(t('feed.published'));
   p.onClose();
  }catch(error){
   setError((error as Error).message);
  }finally{
   setBusy(false);
  }
 }

 return <Modal title={t('feed.new')} onClose={p.onClose}>
  <form className="post-composer" onSubmit={submit}>
   <input
    ref={input}
    hidden
    type="file"
    accept="image/jpeg,image/png,image/webp"
    onChange={choose}
   />

   <button
    type="button"
    className={`post-picker ${preview?'has-preview':'fio-pattern-dark'}`}
    onClick={()=>input.current?.click()}
   >
    {preview?
     <>
      <img src={preview} alt={t('feed.previewAlt')}/>
      <span>
       <ImagePlus size={18}/>
       {t('feed.changePhoto')}
      </span>
     </>
     :
     <>
      <ImagePlus size={28}/>
      <strong>{t('feed.choosePhoto')}</strong>
      <small>{t('feed.imageHelp')}</small>
     </>
    }
   </button>

   <label className="field">
    {t('feed.caption')}

    <textarea
     value={caption}
     maxLength={500}
     rows={4}
     onChange={event=>setCaption(event.target.value)}
     placeholder={t('feed.captionPlaceholder')}
    />

    <span className="field-counter">
     {caption.length}/500
    </span>
   </label>

   {error&&
    <p className="form-error" role="alert">
     {error}
    </p>
   }

   <div className="modal-actions">
    <button
     type="button"
     className="ghost"
     onClick={p.onClose}
     disabled={busy}
    >
     <X size={17}/>
     {t('common.cancel')}
    </button>

    <button
     className="primary"
     disabled={busy||!file}
    >
     {busy?t('feed.publishing'):t('feed.publish')}
    </button>
   </div>
  </form>
 </Modal>;
}
