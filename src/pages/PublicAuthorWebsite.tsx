import { useEffect, useState } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import WebsiteLoading from '../components/WebsiteLoading'
import { apiBaseUrl } from '../api/config'
import AuthorSite from '../websites/AuthorSite'
import { normalizeAuthorWebsite, type AuthorWebsite } from '../websites/model'

export default function PublicAuthorWebsite(){const {username=''}=useParams();const location=useLocation();const [site,setSite]=useState<AuthorWebsite|null>(null);const [missing,setMissing]=useState(false);useEffect(()=>{let live=true;fetch(`${apiBaseUrl()}/api/public/author/${encodeURIComponent(username)}`).then(r=>r.ok?r.json():Promise.reject()).then(data=>live&&setSite(normalizeAuthorWebsite(data.website,username))).catch(()=>live&&setMissing(true));return()=>{live=false}},[username]);if(missing)return <main className="grid min-h-screen place-items-center bg-[#08090d] px-6 text-center text-[#f2eadf]"><div><span className="text-5xl text-[#d6a64b]">☾</span><h1 className="mt-5 font-serif text-4xl">This page is between chapters.</h1><p className="mt-3 text-white/45">The author website is unpublished or unavailable.</p></div></main>;if(!site)return <WebsiteLoading/>;return <main className="min-h-screen"><AuthorSite site={site} aboutOnly={location.pathname.split('/').length>2}/></main>}
