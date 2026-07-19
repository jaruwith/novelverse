export type StoryType = "NOVEL" | "COMIC";
export type StoryStatus = "ONGOING" | "COMPLETED" | "HIATUS" | "CANCELLED";
export type PublicationStatus = "DRAFT" | "PUBLISHED" | "HIDDEN" | "ARCHIVED";

export type Creator = { username: string; name: string; bio: string; joined: string; likes: number; works: number };
export type Chapter = { number: number; title: string; views: number; likes: number; comments: number; published: string; status: PublicationStatus };
export type Story = { id: string; slug: string; title: string; type: StoryType; status: StoryStatus; publication: PublicationStatus; creator: string; category: string; tags: string[]; description: string; followers: number; editorial?: boolean; firstPublished: string; updated: string; color: string; chapters: Chapter[] };

export const categories = ["แฟนตาซี", "โรแมนติก", "ลึกลับ", "ไซไฟ", "ชีวิตประจำวัน", "ผจญภัย", "ตลก", "ดราม่า"];
export const tags = ["เวทมนตร์", "อบอุ่นหัวใจ", "สืบสวน", "โลกอนาคต", "มิตรภาพ", "ย้อนเวลา", "โรงเรียน", "ทำอาหาร", "ครอบครัว", "การเดินทาง"];

export const creators: Creator[] = [
  { username: "praewa-writes", name: "แพรวาเล่าเรื่อง", bio: "ชอบเขียนโลกเล็ก ๆ ที่มีความหวังซ่อนอยู่", joined: "12 มี.ค. 2567", likes: 19400, works: 3 },
  { username: "northwind", name: "ลมเหนือ", bio: "นักวาดและนักเล่าเรื่องเมืองเหนือ", joined: "8 ก.ค. 2567", likes: 16820, works: 2 },
  { username: "mali-moon", name: "มะลิใต้จันทร์", bio: "นิยายลึกลับและคืนฝนพรำ", joined: "21 พ.ย. 2567", likes: 14210, works: 2 },
  { username: "bluepencil", name: "ดินสอสีคราม", bio: "การ์ตูนสบายใจสำหรับวันเหนื่อย ๆ", joined: "2 ม.ค. 2568", likes: 12100, works: 2 },
  { username: "orbit-tales", name: "วงโคจร", bio: "ไซไฟที่พูดถึงความเป็นมนุษย์", joined: "15 ก.พ. 2568", likes: 9900, works: 3 },
  { username: "new-leaf", name: "ใบไม้หน้าใหม่", bio: "สมาชิกใหม่ กำลังเตรียมผลงานเรื่องแรก", joined: "9 ก.ค. 2569", likes: 0, works: 0 },
];

const makeChapters = (count: number, base: number, archived = false): Chapter[] => Array.from({ length: count }, (_, index) => ({
  number: index + 1, title: index === 0 ? "จุดเริ่มต้นของเรื่องราว" : `ร่องรอยที่ ${index + 1}`,
  views: base - index * 137, likes: Math.max(24, Math.round(base / 12) - index * 8), comments: 3 + index * 2,
  published: `${12 + index} ก.ค. 2569`, status: archived && index === count - 1 ? "ARCHIVED" : "PUBLISHED",
}));

const raw: Omit<Story, "chapters">[] = [
  { id:"nv-01",slug:"library-after-rain",title:"ห้องสมุดหลังสายฝน",type:"NOVEL",status:"ONGOING",publication:"PUBLISHED",creator:"praewa-writes",category:"แฟนตาซี",tags:["เวทมนตร์","อบอุ่นหัวใจ"],description:"บรรณารักษ์ฝึกหัดพบว่าหนังสือทุกเล่มจะเปิดประตูได้หนึ่งครั้งหลังฝนหยุด",followers:12840,editorial:true,firstPublished:"2026-07-17",updated:"18 ก.ค. 2569",color:"mint"},
  { id:"nv-02",slug:"last-tram-home",title:"รถรางเที่ยวสุดท้าย",type:"COMIC",status:"ONGOING",publication:"PUBLISHED",creator:"northwind",category:"ลึกลับ",tags:["สืบสวน","การเดินทาง"],description:"รถรางเก่าพาผู้โดยสารไปยังสถานีที่ไม่มีอยู่บนแผนที่",followers:10230,firstPublished:"2026-07-16",updated:"18 ก.ค. 2569",color:"blue"},
  { id:"nv-03",slug:"moonlit-recipe",title:"สูตรลับครัวแสงจันทร์",type:"NOVEL",status:"COMPLETED",publication:"PUBLISHED",creator:"praewa-writes",category:"โรแมนติก",tags:["ทำอาหาร","อบอุ่นหัวใจ"],description:"ร้านอาหารกลางคืนที่เสิร์ฟเมนูจากความทรงจำ",followers:18650,editorial:true,firstPublished:"2026-05-01",updated:"17 ก.ค. 2569",color:"orange"},
  { id:"nv-04",slug:"orbit-404",title:"วงโคจรหมายเลข 404",type:"COMIC",status:"ONGOING",publication:"PUBLISHED",creator:"orbit-tales",category:"ไซไฟ",tags:["โลกอนาคต","มิตรภาพ"],description:"ช่างซ่อมหุ่นยนต์รับสัญญาณจากดาวที่หายไป",followers:9320,firstPublished:"2026-07-18",updated:"18 ก.ค. 2569",color:"violet"},
  { id:"nv-05",slug:"homeroom-seven",title:"ห้องเรียนหมายเลขเจ็ด",type:"NOVEL",status:"HIATUS",publication:"PUBLISHED",creator:"mali-moon",category:"ลึกลับ",tags:["โรงเรียน","สืบสวน"],description:"นักเรียนใหม่พบชื่อของตนในสมุดเช็กชื่อเมื่อยี่สิบปีก่อน",followers:7750,firstPublished:"2026-03-11",updated:"10 ก.ค. 2569",color:"slate"},
  { id:"nv-06",slug:"grandmas-cloud-shop",title:"ร้านเมฆของคุณยาย",type:"COMIC",status:"COMPLETED",publication:"PUBLISHED",creator:"bluepencil",category:"ชีวิตประจำวัน",tags:["ครอบครัว","อบอุ่นหัวใจ"],description:"ร้านเล็กบนเนินเขารับซ่อมอากาศเสียและหัวใจที่เหนื่อยล้า",followers:21100,editorial:true,firstPublished:"2026-01-20",updated:"15 ก.ค. 2569",color:"sky"},
  { id:"nv-07",slug:"clockwork-forest",title:"ป่ากลไกไม่หลับใหล",type:"NOVEL",status:"ONGOING",publication:"PUBLISHED",creator:"northwind",category:"ผจญภัย",tags:["เวทมนตร์","การเดินทาง"],description:"เด็กส่งสารต้องข้ามป่าที่เปลี่ยนเส้นทางทุกเที่ยงคืน",followers:8540,firstPublished:"2026-07-17",updated:"17 ก.ค. 2569",color:"green"},
  { id:"nv-08",slug:"tomorrow-cafe",title:"คาเฟ่ของวันพรุ่งนี้",type:"COMIC",status:"ONGOING",publication:"PUBLISHED",creator:"bluepencil",category:"ตลก",tags:["ทำอาหาร","ย้อนเวลา"],description:"กาแฟทุกแก้วบอกเรื่องพรุ่งนี้ แต่บาริสต้าจำสูตรไม่ได้",followers:6240,firstPublished:"2026-06-04",updated:"16 ก.ค. 2569",color:"peach"},
  { id:"nv-09",slug:"letters-from-low-tide",title:"จดหมายจากน้ำลด",type:"NOVEL",status:"COMPLETED",publication:"PUBLISHED",creator:"mali-moon",category:"ดราม่า",tags:["ครอบครัว","การเดินทาง"],description:"จดหมายเก่าพาพี่น้องกลับไปยังบ้านริมทะเล",followers:14800,firstPublished:"2025-12-15",updated:"12 ก.ค. 2569",color:"sand"},
  { id:"nv-10",slug:"tiny-planet-club",title:"ชมรมดาวเคราะห์จิ๋ว",type:"COMIC",status:"ONGOING",publication:"PUBLISHED",creator:"orbit-tales",category:"ไซไฟ",tags:["โรงเรียน","มิตรภาพ"],description:"ชมรมวิทยาศาสตร์เลี้ยงดาวเคราะห์ดวงหนึ่งไว้ในตู้ปลา",followers:7200,firstPublished:"2026-06-21",updated:"14 ก.ค. 2569",color:"indigo"},
  { id:"nv-11",slug:"tea-at-dawn",title:"ชาอุ่นตอนรุ่งสาง",type:"NOVEL",status:"CANCELLED",publication:"ARCHIVED",creator:"praewa-writes",category:"ชีวิตประจำวัน",tags:["อบอุ่นหัวใจ"],description:"บันทึกบทสนทนาในร้านชาที่เคยเปิดก่อนพระอาทิตย์ขึ้น",followers:2300,firstPublished:"2025-10-12",updated:"2 ม.ค. 2569",color:"rose"},
  { id:"nv-12",slug:"map-of-wind",title:"แผนที่ของสายลม",type:"NOVEL",status:"ONGOING",publication:"DRAFT",creator:"orbit-tales",category:"ผจญภัย",tags:["การเดินทาง","มิตรภาพ"],description:"นักทำแผนที่วาดเส้นทางของสิ่งที่มองไม่เห็น",followers:0,firstPublished:"2026-07-18",updated:"ฉบับร่าง",color:"aqua"},
  { id:"nv-13",slug:"hidden-garden-code",title:"รหัสลับสวนกระจก",type:"COMIC",status:"ONGOING",publication:"HIDDEN",creator:"northwind",category:"แฟนตาซี",tags:["เวทมนตร์","สืบสวน"],description:"สวนกระจกเผยความลับที่ควรถูกซ่อน",followers:4100,firstPublished:"2026-04-09",updated:"ถูกซ่อน",color:"lime"},
];

export const stories: Story[] = raw.map((story, i) => ({ ...story, chapters: makeChapters(4 + (i % 4), 7200 - i * 280, story.publication === "ARCHIVED") }));
export const publicStories = stories.filter((s) => s.publication === "PUBLISHED");
export const totalViews = (story: Story) => story.chapters.reduce((sum, chapter) => sum + chapter.views, 0);
export const totalLikes = (story: Story) => story.chapters.reduce((sum, chapter) => sum + chapter.likes, 0);
export const storyBySlug = (slug: string) => stories.find((s) => s.slug === slug) ?? stories[0];

export const comments = [
  { user:"นักอ่านริมหน้าต่าง", time:"2 ชั่วโมงก่อน", text:"บรรยากาศตอนท้ายบทดีมาก อ่านแล้วอยากรู้ต่อเลย", reported:false },
  { user:"เจ้าก้อนเมฆ", time:"เมื่อวาน", text:"ชอบรายละเอียดเล็ก ๆ ของตัวละคร ขอบคุณสำหรับตอนใหม่ค่ะ", reported:false },
  { user:"อ่านก่อนนอน", time:"2 วันที่แล้ว", text:"ฉากนี้ทำให้ย้อนกลับไปอ่านบทแรกอีกรอบ", reported:true },
];

export const reports = [
  { id:"RP-1042", target:"COMMENT", reporter:"mango-reader", reason:"ถ้อยคำไม่เหมาะสม", status:"OPEN" },
  { id:"RP-1041", target:"STORY", reporter:"quietpage", reason:"หมวดหมู่ไม่ตรงเนื้อหา", status:"REVIEWING" },
  { id:"RP-1039", target:"USER", reporter:"northwind", reason:"แอบอ้างตัวตน", status:"OPEN" },
];
