export type StandardAdvertisement = { id:string; advertiserName:string; title?:string; description?:string; imageUrl:string; targetUrl:string; type:"STANDARD"; sortOrder:number; isActive:boolean };
export type PremiumPopupAdvertisement = { id:string; advertiserName:string; title:string; imageUrl:string; targetUrl:string; type:"PREMIUM_POPUP"; closeDelaySeconds:number; isActive:boolean };

export const standardAdvertisements: StandardAdvertisement[] = [
  {id:"ad-004",advertiserName:"Moonlight Studio",title:"เรื่องเล่าก่อนนอน",description:"พื้นที่แนะนำผลงานและกิจกรรมจากผู้สนับสนุนจำลอง",imageUrl:"/window.svg",targetUrl:"https://example.com/?ad=004",type:"STANDARD",sortOrder:4,isActive:true},
  {id:"ad-001",advertiserName:"Green Page",title:"อ่านโลกใหม่ทุกวัน",description:"พื้นที่โฆษณาตัวอย่างลำดับที่ 1",imageUrl:"/globe.svg",targetUrl:"https://example.com/?ad=001",type:"STANDARD",sortOrder:1,isActive:true},
  {id:"ad-010",advertiserName:"Story Cloud",title:"คลังเรื่องราวบนก้อนเมฆ",description:"พื้นที่โฆษณาตัวอย่างลำดับที่ 10",imageUrl:"/file.svg",targetUrl:"https://example.com/?ad=010",type:"STANDARD",sortOrder:10,isActive:true},
  {id:"ad-007",advertiserName:"Northwind Creative",title:"แรงบันดาลใจจากสายลม",description:"พื้นที่โฆษณาตัวอย่างลำดับที่ 7",imageUrl:"/next.svg",targetUrl:"https://example.com/?ad=007",type:"STANDARD",sortOrder:7,isActive:true},
  {id:"ad-003",advertiserName:"Warm Cup",title:"พักอ่านสักครู่",description:"พื้นที่โฆษณาตัวอย่างลำดับที่ 3",imageUrl:"/file.svg",targetUrl:"https://example.com/?ad=003",type:"STANDARD",sortOrder:3,isActive:true},
  {id:"ad-002",advertiserName:"Blue Pencil",title:"วาดทุกจินตนาการ",description:"พื้นที่โฆษณาตัวอย่างลำดับที่ 2",imageUrl:"/window.svg",targetUrl:"https://example.com/?ad=002",type:"STANDARD",sortOrder:2,isActive:true},
  {id:"ad-009",advertiserName:"Orbit Lab",title:"เรื่องเล่าจากวงโคจร",description:"พื้นที่โฆษณาตัวอย่างลำดับที่ 9",imageUrl:"/globe.svg",targetUrl:"https://example.com/?ad=009",type:"STANDARD",sortOrder:9,isActive:true},
  {id:"ad-006",advertiserName:"Tiny Planet Club",title:"พื้นที่เล็กสำหรับไอเดียใหญ่",description:"พื้นที่โฆษณาตัวอย่างลำดับที่ 6",imageUrl:"/globe.svg",targetUrl:"https://example.com/?ad=006",type:"STANDARD",sortOrder:6,isActive:true},
  {id:"ad-008",advertiserName:"Tomorrow Café",title:"พบกันในวันพรุ่งนี้",description:"พื้นที่โฆษณาตัวอย่างลำดับที่ 8",imageUrl:"/window.svg",targetUrl:"https://example.com/?ad=008",type:"STANDARD",sortOrder:8,isActive:true},
  {id:"ad-005",advertiserName:"Library Friends",title:"สนับสนุนชุมชนนักอ่าน",description:"พื้นที่โฆษณาตัวอย่างลำดับที่ 5",imageUrl:"/next.svg",targetUrl:"https://example.com/?ad=005",type:"STANDARD",sortOrder:5,isActive:true},
];
export const premiumPopupAdvertisements: PremiumPopupAdvertisement[] = [{id:"premium-ad-001",type:"PREMIUM_POPUP",advertiserName:"Premium Sponsor",title:"โฆษณาพรีเมียม",imageUrl:"/globe.svg",targetUrl:"https://example.com/?ad=premium",closeDelaySeconds:5,isActive:true}];
export function getActiveStandardAdvertisements(limit?:number){const sorted=standardAdvertisements.filter((ad)=>ad.isActive).sort((a,b)=>a.sortOrder-b.sortOrder||a.id.localeCompare(b.id));return typeof limit==="number"?sorted.slice(0,limit):sorted}
export function getActivePremiumPopup(){return premiumPopupAdvertisements.filter((ad)=>ad.isActive).sort((a,b)=>a.id.localeCompare(b.id))[0]??null}
export function isEligibleForReaderAdvertisements(role:"guest"|"member"|"admin",isAdFreeMember:boolean){return role==="guest"||(role==="member"&&!isAdFreeMember)}

// Compatibility for the superseded popup component while visual documentation migrates.
export type AdvertisementPosition="left"|"center"|"right";
export type AdvertisementConfig={id:string;title:string;sponsorLabel?:string;imageUrl:string;targetUrl:string;position:AdvertisementPosition;closeDelaySeconds:number;isActive:boolean};
export const novelReaderAdvertisement:AdvertisementConfig={id:"legacy-ad-demo",title:"พื้นที่โฆษณาตัวอย่าง",sponsorLabel:"ผู้สนับสนุนจำลอง",imageUrl:"/globe.svg",targetUrl:"https://example.com",position:"center",closeDelaySeconds:5,isActive:false};
export const isEligibleForNovelAdvertisement=isEligibleForReaderAdvertisements;
