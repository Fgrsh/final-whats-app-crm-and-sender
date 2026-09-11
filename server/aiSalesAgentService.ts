import fs from "fs";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import type {
  AIAgentSettings,
  AIKnowledgeBase,
  AIProduct,
  AIFaqItem,
  AIAgentSession,
  AIOrder,
  AIOrderItem,
  AIOrderStatus,
  AIAgentActivityLog,
  AIAgentDashboardStats,
  AILeadQuality,
  AILeadIntent,
  AISessionStatus,
} from "../src/types.ts";
import { crmService } from "./crmService.ts";
import { normalizePhoneNumber } from "./phoneUtils.ts";

let aiClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI | null {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      aiClient = new GoogleGenAI({ apiKey });
    }
  }
  return aiClient;
}

export const SOLO_ITALIANO_DEFAULT_KNOWLEDGE: AIKnowledgeBase = {
  companyName: "سولو ايطاليانو - Solo Italiano",
  businessSummary:
    "شركة سولو ايطاليانو (Solo Italiano) مورد معتمد في القاهرة لمنتجات وخامات الأغذية الإيطالية الاحترافية للمطاعم والفنادق ومطابخ البيتزا والكيترينج (Food Service Price List 2026). متخصصون في توريد أجود أنواع الموزاريلا الطبيعية، خلطات الأجبان، الطماطم المقشرة الإيطالية، خل البلسميك، زيت الزيتون، الدقيق تايبو 00، المخللات والمقبلات.",
  currency: "EGP",
  products: [
    {
      id: "solo-prod-01",
      name: "Mozzarella Cheese — 100% (جبنة موزاريلا 100%)",
      category: "Mozzarella & Cheese",
      price: 230,
      currency: "EGP",
      sku: "MOZZ-100",
      inStock: true,
      description: "جبنة موزاريلا طبيعي 100% فاخرة من سولو ايطاليانو مخصصة للبيتزا والمطاعم الاحترافية. متوفرة في عبوات 1 كجم و 2.5 كجم (كرتونة 10 كجم). السعر للكيلو.",
      features: ["طبيعي 100%", "عبوة 1 كجم و 2.5 كجم", "كرتونة 10 كجم", "مطاطية وطعم إيطالي ممتاز"]
    },
    {
      id: "solo-prod-02",
      name: "Mozzarella Cheese — 100% Block (جبنة موزاريلا بلوك 100%)",
      category: "Mozzarella & Cheese",
      price: 550,
      currency: "EGP",
      sku: "MOZZ-100-BLK",
      inStock: true,
      description: "جبنة موزاريلا قالب بلوك 100% طبيعي - قالب 2 كجم (كرتونة 10 كجم تحتوي على 5 قوالب). السعر للقالب 2 كجم.",
      features: ["قالب بلوك 2 كجم", "كرتونة 10 كجم", "جودة احترافية للشيفات"]
    },
    {
      id: "solo-prod-03",
      name: "Mozzarella Cheese — 75% (جبنة موزاريلا 75%)",
      category: "Mozzarella & Cheese",
      price: 180,
      currency: "EGP",
      sku: "MOZZ-75",
      inStock: true,
      description: "جبنة موزاريلا 75% اقتصادية وعالية الأداء للمطاعم. عبوة 1 كجم (كرتونة 10 كجم). السعر للكيلو.",
      features: ["نسبة 75%", "عبوة 1 كجم", "كرتونة 10 كجم"]
    },
    {
      id: "solo-prod-04",
      name: "Mozzarella Cheese — 50% (جبنة موزاريلا 50%)",
      category: "Mozzarella & Cheese",
      price: 155,
      currency: "EGP",
      sku: "MOZZ-50",
      inStock: true,
      description: "جبنة موزاريلا 50% اقتصادية للمخبوزات وسندوتشات الفاست فود. عبوة 1 كجم (كرتونة 10 كجم). السعر للكيلو.",
      features: ["نسبة 50%", "عبوة 1 كجم", "كرتونة 10 كجم"]
    },
    {
      id: "solo-prod-05",
      name: "Roumy Cheese, Grated (جبنة رومي مبشورة)",
      category: "Mozzarella & Cheese",
      price: 215,
      currency: "EGP",
      sku: "ROUMY-GRAT",
      inStock: true,
      description: "جبنة رومي معتقة مبشورة جاهزة للاستخدام الفوري في البيتزا والمعجنات والباستا. عبوة 1 كجم (كرتونة 10 كجم). السعر للكيلو.",
      features: ["مبشورة جاهزة", "عبوة 1 كجم", "كرتونة 10 كجم", "نكهة معتقة غنية"]
    },
    {
      id: "solo-prod-06",
      name: "Mixed Cheese Blend (مكس جبن مشكل)",
      category: "Cheese Blends",
      price: 0,
      currency: "EGP",
      sku: "BLEND-MIX",
      inStock: true,
      description: "مكس أجبان مشكل متوازن للبيتزا والمطاعم. عبوة 1 كجم (كرتونة 10 كجم). السعر عند الطلب (Price on request).",
      features: ["خلطة متوازنة للبيتزا", "عبوة 1 كجم", "كرتونة 10 كجم", "السعر عند الطلب"]
    },
    {
      id: "solo-prod-07",
      name: "Triple Cheese Blend (مكس أجبان ثلاثي - رومي • إيمنتال • إيدام)",
      category: "Cheese Blends",
      price: 0,
      currency: "EGP",
      sku: "BLEND-TRIPLE",
      inStock: true,
      description: "مكس جبن ثلاثي فاخر يتكون من (رومي معتق • إيمنتال سويسري • إيدام). عبوة 2 كجم (كرتونة 10 كجم). السعر عند الطلب (Price on request).",
      features: ["رومي • إيمنتال • إيدام", "عبوة 2 كجم", "كرتونة 10 كجم", "السعر عند الطلب"]
    },
    {
      id: "solo-prod-08",
      name: "Double Cheese Blend (مكس أجبان ثنائي - جودا • شيدر)",
      category: "Cheese Blends",
      price: 0,
      currency: "EGP",
      sku: "BLEND-DOUBLE",
      inStock: true,
      description: "مكس أجبان ثنائي فاخر يتكون من (جبنة جودا • جبنة شيدر) ذوبان وطعم مميز للبرجر والبيتزا والباستا. عبوة 2 كجم (كرتونة 10 كجم). السعر عند الطلب.",
      features: ["جودا • شيدر", "عبوة 2 كجم", "كرتونة 10 كجم", "السعر عند الطلب"]
    },
    {
      id: "solo-prod-09",
      name: "Peeled Tomatoes — La Bella San Marzano (طماطم مقشرة إيطالية سان مارزانو)",
      category: "Tomato Products",
      price: 1650,
      currency: "EGP",
      sku: "TOM-SAN-MARZ",
      inStock: true,
      description: "طماطم إيطالية كاملة مقشرة فاخرة سان مارزانو مستوردة من إيطاليا - الأساس الأفضل لصلصات البيتزا والباستا الإيطالية الأصلية. علبة 2.55 كجم (كرتونة 10 كجم). السعر للكرتونة.",
      features: ["مستورد من إيطاليا (Italy)", "San Marzano Style", "علبة 2.55 كجم", "كرتونة 10 كجم"]
    },
    {
      id: "solo-prod-10",
      name: "Whole Peeled Tomatoes in Tomato Juice (طماطم كاملة مقشرة في عصير طماطم)",
      category: "Tomato Products",
      price: 1000,
      currency: "EGP",
      sku: "TOM-PEELED-JUICE",
      inStock: true,
      description: "طماطم كاملة مقشرة محفوظة في عصير طماطم مركز للمطاعم والمطابخ. علبة 2.55 كجم (كرتونة 10 كجم). السعر للكرتونة.",
      features: ["طماطم كاملة مقشرة", "علبة 2.55 كجم", "كرتونة 10 كجم"]
    },
    {
      id: "solo-prod-11",
      name: "Sun-Dried Tomatoes in Sunflower Oil 300g (طماطم مجففة في زيت دوار الشمس 300 جم)",
      category: "Tomato Products",
      price: 950,
      currency: "EGP",
      sku: "TOM-SUNDRIED-300",
      inStock: true,
      description: "طماطم مجففة تحت أشعة الشمس محفوظة في زيت دوار الشمس عالي الجودة. كرتونة تحتوي على 12 برطمان × 300 جم. السعر للكرتونة.",
      features: ["برطمان 300 جم", "12 برطمان بالكرتونة", "محفوظة في زيت دوار الشمس"]
    },
    {
      id: "solo-prod-12",
      name: "Sun-Dried Tomatoes in Sunflower Oil 1kg (طماطم مجففة في زيت دوار الشمس 1 كجم)",
      category: "Tomato Products",
      price: 1450,
      currency: "EGP",
      sku: "TOM-SUNDRIED-1KG",
      inStock: true,
      description: "طماطم مجففة في زيت دوار الشمس بحجم الشيفات والمطاعم. كرتونة تحتوي على 6 برطمانات × 1 كجم. السعر للكرتونة.",
      features: ["برطمان 1 كجم", "6 برطمانات بالكرتونة", "مثالية للسلطات والمقبلات والباستا"]
    },
    {
      id: "solo-prod-13",
      name: "Aceto Balsamico di Modena (خل بلسميك مودينا إيطالي معتق)",
      category: "Vinegar & Olive Oil",
      price: 2550,
      currency: "EGP",
      sku: "BALS-MODENA",
      inStock: true,
      description: "خل بلسميك مودينا أصلي مستورد من إيطاليا للمطابخ والفنادق الراقية ذات الهوية الإيطالية. زجاجة 1 لتر (كرتونة 12 لتر). السعر للكرتونة.",
      features: ["مستورد من مودينا، إيطاليا (Italy)", "زجاجة 1 لتر", "كرتونة 12 لتر"]
    },
    {
      id: "solo-prod-14",
      name: "Balsamic Vinegar (خل بلسميك)",
      category: "Vinegar & Olive Oil",
      price: 770,
      currency: "EGP",
      sku: "BALS-VINEGAR-500",
      inStock: true,
      description: "خل بلسميك عالي الجودة للسلطات والتتبيلات. زجاجة 500 مل (كرتونة 12 زجاجة). السعر للكرتونة.",
      features: ["زجاجة 500 مل", "كرتونة 12 زجاجة"]
    },
    {
      id: "solo-prod-15",
      name: "Olive Oil (زيت زيتون نقي)",
      category: "Vinegar & Olive Oil",
      price: 1900,
      currency: "EGP",
      sku: "OLIVE-OIL-1L",
      inStock: true,
      description: "زيت زيتون نقي للطهي والتتبيلات الإيطالية والمخبوزات. زجاجة 1 لتر (كرتونة 6 زجاجات). السعر للكرتونة.",
      features: ["نقي 100%", "زجاجة 1 لتر", "كرتونة 6 زجاجات"]
    },
    {
      id: "solo-prod-16",
      name: "Sriracha Sauce (صوص سيراتشا حار)",
      category: "Sauces & Flour",
      price: 1250,
      currency: "EGP",
      sku: "SAUCE-SRIRACHA",
      inStock: true,
      description: "صوص سيراتشا حار ممتاز بتوازن حرارة وحموضة مثالي للسندوتشات والمقبلات. عبوة 800 جم (كرتونة 12 زجاجة). السعر للكرتونة.",
      features: ["عبوة 800 جم", "كرتونة 12 زجاجة"]
    },
    {
      id: "solo-prod-17",
      name: "Sweet Chili Sauce 600g (سويت تشيلي صوص 600 جم)",
      category: "Sauces & Flour",
      price: 890,
      currency: "EGP",
      sku: "SAUCE-SWEETCHILI-600",
      inStock: true,
      description: "صوص الفلفل الحلو التايلاندي سويت تشيلي للسبرينج رول والأطباق الآسيوية والأجنحة. كرتونة 12 زجاجة × 600 جم. السعر للكرتونة.",
      features: ["زجاجة 600 جم", "كرتونة 12 زجاجة"]
    },
    {
      id: "solo-prod-18",
      name: "Sweet Chili Sauce 3.4kg (سويت تشيلي صوص 3.4 كجم جالون)",
      category: "Sauces & Flour",
      price: 990,
      currency: "EGP",
      sku: "SAUCE-SWEETCHILI-3.4",
      inStock: true,
      description: "سويت تشيلي صوص حجم اقتصادي مخصص لخطوط إنتاج المطابخ. كرتونة 4 جراكن × 3.4 كجم. السعر للكرتونة.",
      features: ["جركن 3.4 كجم", "كرتونة 4 جراكن", "أعلى توفير للمطاعم"]
    },
    {
      id: "solo-prod-19",
      name: "Dark Soy Sauce (صويا صوص داكن)",
      category: "Sauces & Flour",
      price: 1350,
      currency: "EGP",
      sku: "SAUCE-DARKSOY",
      inStock: true,
      description: "صويا صوص داكن غني القوام واللون للتتبيلات والطهي في الووك. عبوة 320 جم (كرتونة 12 زجاجة). السعر للكرتونة.",
      features: ["عبوة 320 جم", "كرتونة 12 زجاجة", "لون وقوام كثيف"]
    },
    {
      id: "solo-prod-20",
      name: "Farina di Grano Tenero — Tipo 00 (دقيق فاخر تايبو 00 للبيتزا والمخبوزات)",
      category: "Sauces & Flour",
      price: 750,
      currency: "EGP",
      sku: "FLOUR-TIPO-00",
      inStock: true,
      description: "دقيق قمح طري ناعم استخراج تايبو 00 - المعيار الذهبي الاحترافي لصناعة عجينة البيتزا النابوليتانية والمخبوزات الإيطالية الإرتيزان. شيكارة 10 كجم. السعر للشيكارة 10 كجم.",
      features: ["Tipo 00 Professional Standard", "شيكارة 10 كجم", "مثالي للبيتزا والباستا"]
    },
    {
      id: "solo-prod-21",
      name: "Jalapeño Peppers, Sliced (فلفل هالبينو شرائح)",
      category: "Pickles, Peppers & Olives",
      price: 590,
      currency: "EGP",
      sku: "JALAPENO-3.8",
      inStock: true,
      description: "شرائح فلفل هالبينو مخلل حار مقرمش للبيتزا والبرجر والتاكوز. كرتونة 4 برطمانات × 3.8 كجم. السعر للكرتونة.",
      features: ["برطمان 3.8 كجم", "كرتونة 4 برطمانات", "قرمشة وحرارة متوازنة"]
    },
    {
      id: "solo-prod-22",
      name: "Cucumber, Sliced 3.8kg (خيار مخلل شرائح 3.8 كجم)",
      category: "Pickles, Peppers & Olives",
      price: 590,
      currency: "EGP",
      sku: "CUCUMBER-3.8",
      inStock: true,
      description: "شرائح خيار مخلل مقرمشة جاهزة للسندوتشات والبرجر. كرتونة 4 برطمانات × 3.8 كجم. السعر للكرتونة.",
      features: ["برطمان 3.8 كجم", "كرتونة 4 برطمانات"]
    },
    {
      id: "solo-prod-23",
      name: "Cucumber, Sliced 5kg (خيار مخلل شرائح 5 كجم)",
      category: "Pickles, Peppers & Olives",
      price: 600,
      currency: "EGP",
      sku: "CUCUMBER-5KG",
      inStock: true,
      description: "شرائح خيار مخلل حجم اقتصادي للمطاعم الكبرى. كرتونة تحتوي على 2 عبوة × 5 كجم. السعر للكرتونة.",
      features: ["عبوة 5 كجم", "كرتونة عبوتين (10 كجم إجمالي)"]
    },
    {
      id: "solo-prod-24",
      name: "Kalamata Olives, Pitted (زيتون كلاماتا مخلي من النواة)",
      category: "Pickles, Peppers & Olives",
      price: 1220,
      currency: "EGP",
      sku: "OLIVES-KALAMATA",
      inStock: true,
      description: "زيتون كلاماتا يوناني فاخر مخلي من النواة جاهز للبيتزا وسلطة سيزر والباستا. كرتونة 12 برطمان × 1 كجم. السعر للكرتونة.",
      features: ["مخلي من النواة جاهز", "برطمان 1 كجم", "كرتونة 12 برطمان", "نكهة فاخرة مميزة"]
    }
  ],
  faqs: [
    {
      id: "faq-1",
      question: "هل تبيعون للأفراد والقطاعي وما هي أسعار القطاعي؟",
      answer: "نوفر البيع بالقطاعي لمنتجات الجبن الفاخرة (الموزاريلا، الرومي، خلطات الأجبان) وزيت الزيتون النقي بزيادة 20 ج.م عن سعر الجملة لكل منتج. أما باقي المنتجات (الطماطم المقشرة الإيطالية، الخل البلسميك، الصصوصات، الدقيق تايبو 00، والمخللات) فنعتذر لحضرتك أقل كمية منها كرتونة كاملة. ويُضاف تلقائياً 50 ج.م مصاريف شحن للطلبات القطاعي (أقل من كرتونة)، بينما الشحن مجاني لطلبات الكرتونة والجملة.",
      category: "الطلبات والتوريد"
    },
    {
      id: "faq-2",
      question: "ما هي مناطق ومواعيد التوريد والتوصيل؟",
      answer: "نوفر توريداً سريعاً خلال 24 إلى 48 ساعة داخل القاهرة والجيزة. كما يتوفر شحن باقي المنتجات الجافة لجميع المحافظات عن طريق شركات الشحن (ما عدا الجبن لحاجتها لسيارات تجميد -18°C).",
      category: "الشحن والتوريد"
    },
    {
      id: "faq-3",
      question: "ما هي طرق السداد والدفع المتاحة للمطاعم والشركات؟",
      answer: "نوفر السداد عبر التحويل البنكي، إنستاباي (InstaPay)، الدفع كاش عند الاستلام، مع إمكانية إصدار فواتير تجارية رسمية للشركات والمنشآت.",
      category: "طرق الدفع"
    },
    {
      id: "faq-4",
      question: "هل تتوفر عينات تجريبية للمطاعم والشيفات؟",
      answer: "نعم بكل سرور! يمكن للشيفات ومسؤولي المشتريات طلب عينات لاختبار جودة الموزاريلا ومطاطيتها قبل اعتماد التعاقد والتوريد المنتظم. أما بالنسبة لباقي المنتجات فيصعب خروج عينات مجانية لها.",
      category: "العينات والتعاقد"
    },
    {
      id: "faq-5",
      question: "كيف يمكنني تقديم طلب شراء أو التعاقد لتوريد دوري؟",
      answer: "يمكنك إرسال المنتجات والكميات المطلوبة وعنوان المنشأة عبر هذا الشات مباشرة وسنقوم بتسجيل الأوردر والتأكيد معك، أو التواصل المباشر مع مبيعات سولو ايطاليانو عبر الهاتف: +201009305802.",
      category: "الطلبات"
    },
    {
      id: "faq-6",
      question: "هل هي منتج طبيعي وبدون إضافات؟",
      answer: "نعم، منتج طبيعي 100% بدون أي زيوت مهدرجة أو إضافات نباتية أو مواد حافظة، وحاصلة على شهادة الأيزو (ISO) المعتمدة ويتم تصديرها عالمياً.",
      category: "جودة المنتجات"
    },
    {
      id: "faq-7",
      question: "أجيبها منين؟ وبتتباع فين؟",
      answer: "الشراء يتم من خلالنا مباشرة عبر هذا الشات أو الهاتف، ويوجد لدينا مندوب توصيل خاص لتسليم الطلب حتى باب منزلك أو منشأتك.",
      category: "منافذ البيع والتوصيل"
    },
    {
      id: "faq-8",
      question: "العنوان فين؟ وأين يقع المقر والمصنع؟",
      answer: "المصنع موجود في مدينة بدر، والمقر الإداري الرئيسي للشركة في المعادي (القاهرة).",
      category: "المقر والعناوين"
    },
    {
      id: "faq-9",
      question: "هل هي موجودة في السوبر ماركت؟",
      answer: "نعم، تباع في سوبر ماركت معينة مختارة ولكن بسعر قطاعي (حوالي 300 جنيه للكيلو)، بينما يمكنك طلبها من خلالنا مباشرة بأسعار التوريد والجملة الممتازة.",
      category: "منافذ البيع والتوصيل"
    },
    {
      id: "faq-10",
      question: "ما هو سعر الجملة؟ وما الفرق عن سعر القطاعي؟",
      answer: "الأسعار المعروضة في الكتالوج هي أسعار الجملة المعتمدة للكرتونة والكميات. أما سعر القطاعي فيكون بزيادة 20 ج.م فقط على كل منتج من الأجبان وزيت الزيتون + 50 ج.م مصاريف شحن للطلبات الأقل من كرتونة.",
      category: "الأسعار والتوريد"
    },
    {
      id: "faq-11",
      question: "هل يوجد فرع أو توصيل في المحافظات؟",
      answer: "لا للأسف لا يوجد فروع في المحافظات ولا نشحن الجبن خارج القاهرة والجيزة لأنها تحتاج سيارات وثلاجات تجميد (-18 مئوية)، أما باقي المنتجات الجافة فنقوم بشحنها لجميع المحافظات عن طريق شركات الشحن.",
      category: "الشحن والتوريد"
    },
    {
      id: "faq-12",
      question: "كم سعر الشحن خارج القاهرة؟",
      answer: "يتوقف سعر الشحن خارج القاهرة على تسعيرة شركة الشحن والمحافظة ويتحملها العميل. جميع المنتجات مسموح بشحنها للمحافظات ما عدا الجبن لأنها تحتاج سيارات تجميد -18°C.",
      category: "الشحن والتوريد"
    },
    {
      id: "faq-13",
      question: "ما هي مدة الصلاحية وطريقة الحفظ؟",
      answer: "تختلف صلاحية المنتجات من منتج لآخر وتكون مدونة بوضوح على العبوة. أما بالنسبة لجميع أنواع الجبن فصلاحيتها سنة كاملة بشرط حفظها في درجة تجميد (-18 مئوية).",
      category: "جودة المنتجات والتخزين"
    },
    {
      id: "faq-14",
      question: "الكرتونة فيها قد إيه؟ وما هي الأوزان والعبوات؟",
      answer: "بالنسبة لجميع أنواع الجبن فالكرتونة تحتوي على 10 كيلو إجمالي (سواء قوالب أو عبوات 1 كجم أو 2 كجم أو 2.5 كجم). وباقي المنتجات تكون أوزان العبوات مدونة بدقة في الكتالوج.",
      category: "التعبئة والتغليف"
    }
  ],
  shippingPolicy: "توريد سريع خلال 24 - 48 ساعة لجميع مناطق القاهرة والجيزة، مع خطوط شحن مبردة للمحافظات. الشحن مجاني لطلبات الكرتونة والجملة، ويُضاف 50 ج.م مصاريف شحن تلقائياً لأي طلب قطاعي (أقل من كرتونة).",
  returnPolicy: "فحص ومعاينة الشحنة قبل الاستلام، مع ضمان استبدال فوري لأي عبوة يثبت بها أي تلف أو عدم مطابقة للمواصفات القياسية المعتمدة.",
  paymentMethods: "تحويل بنكي رسمي • إنستاباي (InstaPay) • كاش عند الاستلام (COD) • فواتير ضريبية للمطاعم والشركات",
  workingHours: {
    enabled: true,
    start: "09:00",
    end: "22:00",
    outsideHoursMessage: "أهلاً بحضرتك في سولو ايطاليانو (Solo Italiano)! تلقينا رسالتك وسنكون سعداء بخدمتك. مواعيد عملنا من 9 صباحاً حتى 10 مساءً، وسيتواصل معك مسؤول التوريدات في بداية يوم العمل."
  },
  contactInfo: "هاتف ومبيعات: +20 100 930 5802 • البريد: info@soloitalianoeg.com • الموقع: soloitalianoeg.com • القاهرة، مصر"
};

export class AISalesAgentService {
  private dataDir: string;
  private settingsFile: string;
  private knowledgeFile: string;
  private sessionsFile: string;
  private ordersFile: string;
  private logsFile: string;

  private settings: AIAgentSettings;
  private knowledge: AIKnowledgeBase;
  private sessions: Map<string, AIAgentSession> = new Map();
  private orders: AIOrder[] = [];
  private logs: AIAgentActivityLog[] = [];

  // Message deduplication and debounce queuing
  private processedMessageIds: Set<string> = new Set();
  private pendingDebounceMap: Map<
    string,
    {
      timer: NodeJS.Timeout;
      messages: string[];
      senderName?: string;
      accountId?: string;
      accountName?: string;
    }
  > = new Map();

  // Reference to WhatsApp manager sender function
  private sendWhatsAppMessageFn: ((
    accountId: string | undefined,
    phone: string,
    message: string
  ) => Promise<{ success: boolean; messageId?: string; error?: string }>) | null = null;

  // Reference to WhatsApp presence indicator function
  private sendPresenceFn: ((
    accountId: string | undefined,
    phone: string,
    presence: "composing" | "paused"
  ) => Promise<void>) | null = null;

  // Anti-Ban & Rate-Limiting Protection State
  private recentIncomingTimestamps: number[] = [];
  private circuitBreakerTripped: boolean = false;
  private circuitBreakerCooldownUntil: number = 0;

  // Outgoing serialized queue to prevent concurrent message bursts
  private outgoingSafeQueue: Array<{
    accountId?: string;
    phone: string;
    customerName: string;
    replyText: string;
    session: AIAgentSession;
    aiResult: any;
  }> = [];
  private isProcessingQueue: boolean = false;
  private recentSentTimestamps: number[] = [];
  private phoneLastReplyMap: Map<string, number> = new Map();
  private serviceBootTimestamp: number = Date.now();

  constructor() {
    this.dataDir = path.join(process.cwd(), "data");
    this.settingsFile = path.join(this.dataDir, "ai_agent_settings.json");
    this.knowledgeFile = path.join(this.dataDir, "ai_agent_knowledge.json");
    this.sessionsFile = path.join(this.dataDir, "ai_agent_sessions.json");
    this.ordersFile = path.join(this.dataDir, "ai_agent_orders.json");
    this.logsFile = path.join(this.dataDir, "ai_agent_logs.json");

    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }

    this.settings = this.loadSettings();
    this.knowledge = this.loadKnowledge();
    this.loadSessions();
    this.loadOrders();
    this.loadLogs();
  }

  public registerWhatsAppSender(
    sendFn: (
      accountId: string | undefined,
      phone: string,
      message: string
    ) => Promise<{ success: boolean; messageId?: string; error?: string }>,
    presenceFn?: (
      accountId: string | undefined,
      phone: string,
      presence: "composing" | "paused"
    ) => Promise<void>
  ) {
    this.sendWhatsAppMessageFn = sendFn;
    if (presenceFn) {
      this.sendPresenceFn = presenceFn;
    }
  }

  // --- Loaders & Savers ---

  private loadSettings(): AIAgentSettings {
    const defaults: AIAgentSettings = {
      enabled: true,
      agentName: "سارة - مستشارة المبيعات الذكية",
      companyName: "متجرنا الرسمي",
      operatingMode: "all",
      responseDelaySeconds: 4,
      typingIndicator: true,
      language: "ar",
      tone: "friendly",
      model: "gemini-3.8-flash",
      temperature: 0.6,
      maxHistoryTurns: 10,
      systemPromptCustom:
        "أنت ممثلة مبيعات محترفة وودودة للغاية عبر واتساب. هدفك مساعدة العميل في استكشاف المنتجات، تقديم عروض مناسبة، وتأكيد طلبات الشراء بسلاسة. تحدث بلهجة عربية بيضاء طبيعية، وكن موجزاً وواضحاً، وتجنب الردود الآلية الطويلة الجافة.",
      humanHandoffKeywords: [
        "موظف",
        "بشري",
        "خدمة العملاء",
        "مدير",
        "انسان",
        "حولني",
        "شكوى",
        "اشتكي",
        "agent",
        "human",
        "support",
        "manager",
        "supervisor",
      ],
      autoHandoffOnAngry: true,
      handoffMessage:
        "يسعدني تحويل محادثتك لأحد زملائنا في فريق خدمة العملاء لمساعدتك بشكل مخصص وفوري. سيتواصل معك أحد ممثلينا خلال لحظات قليلة 🙏",
      welcomeMessage:
        "أهلاً بحضرتك في {company}! 🌸\n⚠️ *تنويه هام:* نود التوضيح في البداية أن جميع أسعارنا الموضحة هي **أسعار جملة وتوريدات تجارية** مخصصة للمطاعم والفنادق والشركات والكميات.\n\nيسعدنا تواصلك معنا، تفضل باختيار رقم الخدمة المطلوبة أو اكتب استفسارك مباشرة:",
      autoScoreLeads: true,
      autoCreateCrmLeads: true,
      whitelistPhones: [],
      blacklistPhones: [],
      antiBanSafetyEnabled: true,
      maxRepliesPerMinute: 3,
      minReplyIntervalSeconds: 8,
      onlyReplyToNewMessages: true,
      maxMessageAgeSeconds: 45,
      enableInteractiveOptions: true,
      optionsMenuPrompt:
        "1️⃣ استعراض المنتجات والأسعار (أسعار جملة) 📦\n2️⃣ تفاصيل الشحن وطرق الدفع والضمان 🚚\n3️⃣ طلب وتأكيد أوردر جديد 🛒\n4️⃣ التحدث مع خدمة العملاء 👨‍💼",
    };

    if (fs.existsSync(this.settingsFile)) {
      try {
        const raw = fs.readFileSync(this.settingsFile, "utf-8");
        const loaded = { ...defaults, ...JSON.parse(raw) };
        if (loaded.model === "gemini-flash-latest") {
          loaded.model = "gemini-3.8-flash";
          this.saveSettings(loaded);
        }
        return loaded;
      } catch (e) {
        console.error("Error loading ai_agent_settings.json:", e);
      }
    }

    this.saveSettings(defaults);
    return defaults;
  }

  private saveSettings(data?: AIAgentSettings) {
    try {
      fs.writeFileSync(
        this.settingsFile,
        JSON.stringify(data || this.settings, null, 2),
        "utf-8"
      );
    } catch (e) {
      console.error("Error saving ai_agent_settings.json:", e);
    }
  }

  private loadKnowledge(): AIKnowledgeBase {
    const defaults: AIKnowledgeBase = SOLO_ITALIANO_DEFAULT_KNOWLEDGE;

    if (fs.existsSync(this.knowledgeFile)) {
      try {
        const raw = fs.readFileSync(this.knowledgeFile, "utf-8");
        return { ...defaults, ...JSON.parse(raw) };
      } catch (e) {
        console.error("Error loading ai_agent_knowledge.json:", e);
      }
    }

    this.saveKnowledge(defaults);
    return defaults;
  }

  private saveKnowledge(data?: AIKnowledgeBase) {
    try {
      fs.writeFileSync(
        this.knowledgeFile,
        JSON.stringify(data || this.knowledge, null, 2),
        "utf-8"
      );
    } catch (e) {
      console.error("Error saving ai_agent_knowledge.json:", e);
    }
  }

  private loadSessions() {
    try {
      if (fs.existsSync(this.sessionsFile)) {
        const list: AIAgentSession[] = JSON.parse(
          fs.readFileSync(this.sessionsFile, "utf-8")
        );
        this.sessions.clear();
        for (const s of list) {
          if (s.phone) {
            this.sessions.set(s.phone, s);
          }
        }
      }
    } catch (e) {
      console.error("Error loading ai_agent_sessions.json:", e);
    }
  }

  private saveSessions() {
    try {
      const list = Array.from(this.sessions.values());
      fs.writeFileSync(
        this.sessionsFile,
        JSON.stringify(list, null, 2),
        "utf-8"
      );
    } catch (e) {
      console.error("Error saving ai_agent_sessions.json:", e);
    }
  }

  private loadOrders() {
    try {
      if (fs.existsSync(this.ordersFile)) {
        const raw = JSON.parse(fs.readFileSync(this.ordersFile, "utf-8"));
        // Requirement: Cancelled extracted orders must be completely deleted
        this.orders = Array.isArray(raw)
          ? raw.filter((o: any) => o && o.status !== "cancelled")
          : [];
        if (Array.isArray(raw) && raw.length !== this.orders.length) {
          this.saveOrders();
        }
      }
    } catch (e) {
      console.error("Error loading ai_agent_orders.json:", e);
      this.orders = [];
    }
  }

  private saveOrders() {
    try {
      // Ensure cancelled orders are permanently excluded before saving
      this.orders = this.orders.filter((o) => o && o.status !== "cancelled");
      fs.writeFileSync(
        this.ordersFile,
        JSON.stringify(this.orders, null, 2),
        "utf-8"
      );
    } catch (e) {
      console.error("Error saving ai_agent_orders.json:", e);
    }
  }

  private loadLogs() {
    try {
      if (fs.existsSync(this.logsFile)) {
        this.logs = JSON.parse(fs.readFileSync(this.logsFile, "utf-8"));
      }
    } catch (e) {
      console.error("Error loading ai_agent_logs.json:", e);
      this.logs = [];
    }
  }

  private saveLogs() {
    try {
      // Keep most recent 500 logs
      if (this.logs.length > 500) {
        this.logs = this.logs.slice(-500);
      }
      fs.writeFileSync(
        this.logsFile,
        JSON.stringify(this.logs, null, 2),
        "utf-8"
      );
    } catch (e) {
      console.error("Error saving ai_agent_logs.json:", e);
    }
  }

  public addLog(entry: Omit<AIAgentActivityLog, "id" | "timestamp">) {
    const log: AIAgentActivityLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      ...entry,
    };
    this.logs.unshift(log);
    this.saveLogs();
  }

  // --- External Getters & Setters ---

  public reloadAll() {
    this.settings = this.loadSettings();
    this.knowledge = this.loadKnowledge();
    this.loadSessions();
    this.loadOrders();
    this.loadLogs();
  }

  public getSettings(): AIAgentSettings {
    return this.settings;
  }

  public updateSettings(newSettings: Partial<AIAgentSettings>): AIAgentSettings {
    this.settings = { ...this.settings, ...newSettings };
    if (newSettings.companyName) {
      this.knowledge.companyName = newSettings.companyName;
      this.saveKnowledge();
    }
    this.saveSettings();
    this.addLog({
      phone: "SYSTEM",
      type: "incoming_message",
      title: "تحديث هوية وإعدادات الوكيل",
      details: `تم حفظ الإعدادات بنجاح (اسم الوكيل: ${this.settings.agentName} | الشركة: ${this.settings.companyName}).`,
    });
    return this.settings;
  }

  public getKnowledge(): AIKnowledgeBase {
    return this.knowledge;
  }

  public updateKnowledge(newKb: Partial<AIKnowledgeBase>): AIKnowledgeBase {
    this.knowledge = { ...this.knowledge, ...newKb };
    if (newKb.companyName) {
      this.settings.companyName = newKb.companyName;
      this.saveSettings();
    }
    this.saveKnowledge();
    this.addLog({
      phone: "SYSTEM",
      type: "incoming_message",
      title: "تحديث قاعدة المعرفة والمنتجات",
      details: `تم تحديث بيانات ${this.knowledge.products.length} منتج و ${this.knowledge.faqs.length} سؤال شائع (اسم النشاط: ${this.knowledge.companyName}).`,
    });
    return this.knowledge;
  }

  public deleteProduct(productId: string): AIKnowledgeBase {
    const prevCount = this.knowledge.products.length;
    const prod = this.knowledge.products.find((p) => p.id === productId);
    this.knowledge.products = this.knowledge.products.filter((p) => p.id !== productId);
    this.saveKnowledge();
    this.addLog({
      phone: "SYSTEM",
      type: "incoming_message",
      title: "حذف منتج من الكتالوج",
      details: `تم حذف المنتج "${prod?.name || productId}". المتبقي: ${this.knowledge.products.length} منتج.`,
    });
    return this.knowledge;
  }

  public clearAllProducts(): AIKnowledgeBase {
    const prevCount = this.knowledge.products.length;
    this.knowledge.products = [];
    this.saveKnowledge();
    this.addLog({
      phone: "SYSTEM",
      type: "incoming_message",
      title: "مسح جميع المنتجات من الكتالوج",
      details: `تم مسح جميع المنتجات السابقة (${prevCount} منتج). الكتالوج فارغ الآن.`,
    });
    return this.knowledge;
  }

  public replaceProducts(newProducts: AIProduct[]): AIKnowledgeBase {
    const prevCount = this.knowledge.products.length;
    this.knowledge.products = newProducts.map((p, idx) => ({
      id: p.id || `prod-${Date.now()}-${idx}`,
      name: p.name || `منتج ${idx + 1}`,
      category: p.category || "عام",
      price: typeof p.price === "number" ? p.price : Number(p.price) || 0,
      currency: p.currency || this.knowledge.currency || "EGP",
      sku: p.sku || "",
      inStock: p.inStock !== false,
      description: p.description || "",
      features: Array.isArray(p.features) ? p.features : [],
    }));
    this.saveKnowledge();
    this.addLog({
      phone: "SYSTEM",
      type: "incoming_message",
      title: "استبدال كتالوج المنتجات بالكامل",
      details: `تم استبدال المنتجات السابقة (${prevCount} منتج) بـ (${this.knowledge.products.length} منتج جديد) بنجاح.`,
    });
    return this.knowledge;
  }

  public resetToSoloItalianoCatalog(): AIKnowledgeBase {
    this.knowledge = JSON.parse(JSON.stringify(SOLO_ITALIANO_DEFAULT_KNOWLEDGE));
    this.settings.companyName = this.knowledge.companyName;
    this.saveKnowledge();
    this.saveSettings();
    this.addLog({
      phone: "SYSTEM",
      type: "incoming_message",
      title: "استعادة كتالوج سولو ايطاليانو الرسمي 2026",
      details: `تم اعتماد قائمة أسعار سولو ايطاليانو 2026 الرسمية (${this.knowledge.products.length} منتج).`,
    });
    return this.knowledge;
  }

  public getSessions(filter?: {
    status?: AISessionStatus | "all";
    search?: string;
  }): AIAgentSession[] {
    let list = Array.from(this.sessions.values());
    if (filter?.status && filter.status !== "all") {
      list = list.filter((s) => s.status === filter.status);
    }
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      list = list.filter(
        (s) =>
          s.phone.includes(q) ||
          s.name.toLowerCase().includes(q) ||
          s.summary.toLowerCase().includes(q)
      );
    }
    return list.sort(
      (a, b) =>
        new Date(b.lastInteraction).getTime() -
        new Date(a.lastInteraction).getTime()
    );
  }

  public getSession(phone: string): AIAgentSession | undefined {
    const cleanPhone = normalizePhoneNumber(phone);
    return this.sessions.get(cleanPhone);
  }

  public takeoverSession(phone: string, reason = "تدخل يدوي من موظف المبيعات"): boolean {
    const cleanPhone = normalizePhoneNumber(phone);
    const session = this.sessions.get(cleanPhone);
    if (!session) return false;

    session.status = "human_takeover";
    session.handoffReason = reason;
    session.handoffTimestamp = new Date().toISOString();
    session.hasUnreadForHuman = false;
    this.saveSessions();

    this.addLog({
      phone: cleanPhone,
      type: "manual_takeover",
      title: "استلام المحادثة يدوياً (Human Takeover)",
      details: `قام الموظف بإيقاف الذكاء الاصطناعي للرقم ${cleanPhone}. السبب: ${reason}`,
    });

    crmService.addActivityByPhone(cleanPhone, {
      type: "whatsapp",
      title: "استلام المحادثة يدوياً",
      note: `تم إيقاف الوكيل الذكي واستلام المحادثة بواسطة الموظف. السبب: ${reason}`,
      outcome: "human_takeover",
    });

    return true;
  }

  public resumeSession(phone: string): boolean {
    const cleanPhone = normalizePhoneNumber(phone);
    const session = this.sessions.get(cleanPhone);
    if (!session) return false;

    session.status = "active";
    session.handoffReason = undefined;
    session.handoffTimestamp = undefined;
    session.hasUnreadForHuman = false;
    this.saveSessions();

    this.addLog({
      phone: cleanPhone,
      type: "resumed_ai",
      title: "استئناف عمل الوكيل الذكي (AI Resumed)",
      details: `تم إعادة تفعيل الرد التلقائي للذكاء الاصطناعي للرقم ${cleanPhone}.`,
    });

    return true;
  }

  public clearCustomerMemory(phone: string): boolean {
    const cleanPhone = normalizePhoneNumber(phone);
    const session = this.sessions.get(cleanPhone);
    if (!session) return false;

    session.summary = "";
    session.keyPreferences = [];
    session.leadScore = 30;
    session.leadQuality = "cold";
    session.intent = "general";
    session.totalTurns = 0;
    this.saveSessions();

    this.addLog({
      phone: cleanPhone,
      type: "resumed_ai",
      title: "إعادة ضبط ذاكرة العميل",
      details: `تم مسح الذاكرة وتصفير نقاط الاهتمام للرقم ${cleanPhone}.`,
    });

    return true;
  }

  public getOrders(filter?: {
    status?: AIOrder["status"] | "all";
    search?: string;
  }): AIOrder[] {
    let list = [...this.orders];
    if (filter?.status && filter.status !== "all") {
      list = list.filter((o) => o.status === filter.status);
    }
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      list = list.filter(
        (o) =>
          o.customerName.toLowerCase().includes(q) ||
          o.phone.includes(q) ||
          o.items.some((i) => i.productName.toLowerCase().includes(q)) ||
          (o.shippingAddress && o.shippingAddress.toLowerCase().includes(q))
      );
    }
    return list.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  public deleteOrder(orderId: string): boolean {
    const order = this.orders.find((o) => o.id === orderId);
    if (!order) return false;

    this.orders = this.orders.filter((o) => o.id !== orderId);
    this.saveOrders();

    this.addLog({
      phone: order.phone,
      type: "order_updated",
      title: `حذف الطلب نهائياً #${order.id}`,
      details: `تم مسح وحذف الطلب نهائياً من قاعدة البيانات للعميل ${order.customerName} (${order.phone})`,
    });

    return true;
  }

  public clearCancelledOrders(): number {
    const prevCount = this.orders.length;
    this.orders = this.orders.filter((o) => o.status !== "cancelled");
    const count = prevCount - this.orders.length;
    if (count > 0) {
      this.saveOrders();
      this.addLog({
        phone: "SYSTEM",
        type: "order_updated",
        title: "مسح جميع الطلبات المستخرجة الملغية نهائياً",
        details: `تم مسح وتفريغ عدد ${count} طلب ملغي تماماً من النظام.`,
      });
    }
    return count;
  }

  public updateOrderStatus(orderId: string, status: AIOrder["status"]): { order: AIOrder | null; deleted: boolean } {
    const order = this.orders.find((o) => o.id === orderId);
    if (!order) return { order: null, deleted: false };

    // Requirement: Cancelled extracted orders must be completely deleted!
    if (status === "cancelled") {
      this.orders = this.orders.filter((o) => o.id !== orderId);
      this.saveOrders();

      this.addLog({
        phone: order.phone,
        type: "order_updated",
        title: `إلغاء ومسح الطلب نهائياً #${order.id}`,
        details: `تم إلغاء ومسح الطلب تماماً من قاعدة البيانات للعميل ${order.customerName} (${order.phone})`,
      });

      return { order: { ...order, status: "cancelled" }, deleted: true };
    }

    order.status = status;
    order.updatedAt = new Date().toISOString();
    this.saveOrders();

    this.addLog({
      phone: order.phone,
      type: "order_updated",
      title: `تحديث حالة الطلب #${order.id}`,
      details: `تم تغيير حالة الطلب إلى [${status}] بإجمالي ${order.totalAmount} ${order.currency}`,
    });

    return { order, deleted: false };
  }

  public createOrUpdateOrder(orderData: Partial<AIOrder> & { phone: string }): AIOrder {
    const cleanPhone = normalizePhoneNumber(orderData.phone);
    const existing = orderData.id
      ? this.orders.find((o) => o.id === orderData.id)
      : this.orders.find((o) => o.phone === cleanPhone && (o.status === "draft" || o.status === "confirmed"));

    if (orderData.status === "cancelled") {
      if (existing) {
        this.orders = this.orders.filter((o) => o.id !== existing.id);
        this.saveOrders();
      }
      return { ...(existing || orderData), status: "cancelled" } as AIOrder;
    }

    if (existing) {
      Object.assign(existing, {
        ...orderData,
        phone: cleanPhone,
        customerName: orderData.customerName || existing.customerName,
        shippingAddress: orderData.shippingAddress || existing.shippingAddress,
        locationUrl: orderData.locationUrl || existing.locationUrl,
        locationCoordinates: orderData.locationCoordinates || existing.locationCoordinates,
        items: orderData.items && orderData.items.length > 0 ? orderData.items : existing.items,
        totalAmount:
          orderData.totalAmount !== undefined && orderData.totalAmount > 0
            ? orderData.totalAmount
            : existing.totalAmount,
        shippingFee:
          orderData.shippingFee !== undefined
            ? orderData.shippingFee
            : existing.shippingFee,
        isRetail:
          orderData.isRetail !== undefined
            ? orderData.isRetail
            : existing.isRetail,
        notes: orderData.notes
          ? `${existing.notes ? existing.notes + " | " : ""}${orderData.notes}`
          : existing.notes,
        status: orderData.status || existing.status,
        updatedAt: new Date().toISOString(),
      });
      this.saveOrders();
      return existing;
    }

    const newOrder: AIOrder = {
      id: orderData.id || `ORD-${Date.now().toString().slice(-6)}`,
      phone: cleanPhone,
      customerName: orderData.customerName || "عميل واتساب",
      items: orderData.items || [],
      totalAmount: orderData.totalAmount || 0,
      shippingFee: orderData.shippingFee || 0,
      isRetail: orderData.isRetail || false,
      currency: orderData.currency || this.knowledge.currency,
      shippingAddress: orderData.shippingAddress || "",
      locationUrl: orderData.locationUrl || "",
      locationCoordinates: orderData.locationCoordinates,
      paymentMethod: orderData.paymentMethod || "الدفع عند الاستلام",
      notes: orderData.notes || "",
      status: orderData.status || "draft",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.orders.unshift(newOrder);
    this.saveOrders();

    this.addLog({
      phone: cleanPhone,
      type: "order_collected",
      title: `تسجيل طلب شراء جديد #${newOrder.id}`,
      details: `تم استخراج طلب من المحادثة بقيمة ${newOrder.totalAmount} ${newOrder.currency} للعميل ${newOrder.customerName}`,
    });

    return newOrder;
  }

  // --- Location & Order Extraction Helpers ---

  public extractLocationFromText(text: string): {
    hasLocation: boolean;
    locationUrl?: string;
    locationText?: string;
    coordinates?: { latitude: number; longitude: number };
  } {
    if (!text) return { hasLocation: false };

    // 1. WhatsApp Location Pin Marker or Google Maps / Apple Maps URLs
    const urlMatch = text.match(
      /https?:\/\/(?:maps\.app\.goo\.gl|goo\.gl\/maps|maps\.google\.com|www\.google\.com\/maps|maps\.apple\.com)[^\s\)\>\]]*/i
    );
    if (urlMatch) {
      const url = urlMatch[0];
      const coordInUrl = url.match(/(?:q=|@)(-?\d{1,2}\.\d{4,8})\s*,\s*(-?\d{1,3}\.\d{4,8})/);
      let coordinates: { latitude: number; longitude: number } | undefined;
      if (coordInUrl) {
        coordinates = {
          latitude: parseFloat(coordInUrl[1]),
          longitude: parseFloat(coordInUrl[2]),
        };
      }
      return {
        hasLocation: true,
        locationUrl: url,
        locationText: text.trim(),
        coordinates,
      };
    }

    // 2. Direct GPS Coordinates Pattern: e.g. "30.0444, 31.2357" or "30.0444,31.2357"
    const coordsMatch = text.match(/(-?\d{1,2}\.\d{4,8})\s*[,،]\s*(-?\d{1,3}\.\d{4,8})/);
    if (coordsMatch) {
      const lat = parseFloat(coordsMatch[1]);
      const lng = parseFloat(coordsMatch[2]);
      const mapsUrl = `https://maps.google.com/?q=${lat},${lng}`;
      return {
        hasLocation: true,
        locationUrl: mapsUrl,
        locationText: text.trim(),
        coordinates: { latitude: lat, longitude: lng },
      };
    }

    // 3. Location phrases or WhatsApp pin symbol
    if (
      /(?:اللوكيشن|لوكيشن|موقعي|الموقع الجغرافي|موقع الاستلام|location|خريطة جوجل)\s*(?:هو|بتاعي|ده|:|\-)?\s*(.+)/i.test(
        text
      ) ||
      text.includes("📍")
    ) {
      const locKeywords =
        /(?:اللوكيشن|لوكيشن|موقعي|الموقع الجغرافي|موقع الاستلام|location|خريطة جوجل)\s*(?:هو|بتاعي|ده|:|\-)?\s*(.+)/i;
      const match = text.match(locKeywords);
      const candidate = match && match[1] ? match[1].trim() : text.trim();
      return {
        hasLocation: true,
        locationUrl: undefined,
        locationText: candidate,
      };
    }

    return { hasLocation: false };
  }

  public readonly RETAIL_SHIPPING_FEE = 50;
  public readonly RETAIL_CHEESE_AND_OIL_MARKUP = 20;

  /**
   * Find product in knowledge catalog by exact name or substring matching
   */
  public getProductByName(name: string): AIProduct | undefined {
    if (!this.knowledge?.products || !name) return undefined;
    const clean = name.trim().toLowerCase();
    return this.knowledge.products.find((p) => {
      const pName = p.name.trim().toLowerCase();
      return pName === clean || pName.includes(clean) || clean.includes(pName);
    });
  }

  /**
   * Find product in knowledge catalog matching a regular expression
   */
  public getProductByKeyword(regex: RegExp): AIProduct | undefined {
    if (!this.knowledge?.products) return undefined;
    return this.knowledge.products.find(
      (p) => regex.test(p.name) || (p.sku && regex.test(p.sku)) || (p.description && regex.test(p.description))
    );
  }

  /**
   * Dynamically calculate the retail unit price for any product based on its CURRENT wholesale price.
   * Business Rules:
   * 1. Cheeses: retail price = wholesalePrice + 20 EGP (RETAIL_CHEESE_AND_OIL_MARKUP).
   *    E.g. Mozzarella Block (550 EGP wholesale) -> 570 EGP retail!
   *    E.g. Mozzarella 100% (230 EGP wholesale) -> 250 EGP retail!
   * 2. Olive Oil:
   *    If wholesale is carton price (>= 1000 EGP, e.g. 1900 EGP for 6 bottles):
   *    single bottle wholesale is Math.round(cartonPrice / 6) (~317 or 315) + 20 EGP markup = ~335 EGP.
   *    If wholesale is per bottle (< 1000 EGP): wholesale + 20 EGP.
   * 3. NEVER hardcoded! Automatically reflects any price edit in the catalog immediately!
   */
  public getRetailUnitPrice(productName: string, currentWholesalePrice?: number): number {
    let wholesale = typeof currentWholesalePrice === "number" && currentWholesalePrice > 0
      ? currentWholesalePrice
      : 0;

    if (wholesale <= 0) {
      const p = this.getProductByName(productName);
      if (p && typeof p.price === "number" && p.price > 0) {
        wholesale = p.price;
      }
    }

    const pName = (productName || "").toLowerCase();

    // Olive oil handling:
    if (pName.includes("olive") || pName.includes("زيت زيتون")) {
      if (wholesale >= 1000) {
        const singleBottleWholesale = Math.round(wholesale / 6);
        return singleBottleWholesale + this.RETAIL_CHEESE_AND_OIL_MARKUP;
      }
      return (wholesale > 0 ? wholesale : 315) + this.RETAIL_CHEESE_AND_OIL_MARKUP;
    }

    // Cheeses & all others sold in retail:
    if (wholesale > 0) {
      return wholesale + this.RETAIL_CHEESE_AND_OIL_MARKUP;
    }

    return 0;
  }

  /**
   * Check if a message is an order objection, complaint, correction, or cancellation
   * E.g. "مش ده اللي طلبته", "مطلبتش كل ده", "الطلب غلط", "انا طلبت كيلو بس", "الغِ الأوردر", "مش ده طلبي"
   */
  public isOrderObjection(text: string): boolean {
    if (!text || text.length < 3) return false;
    return /(?:مطلبتش|ما\s*طلبتش|مش\s*ده|مش\s*هو|مش\s*كده|مش\s*كدة|الطلب\s*غلط|الاوردر\s*غلط|الأوردر\s*غلط|الطلب\s*مش\s*صح|غلط|خطأ|الغِ|إلغاء|الغاء|كنسل|تعديل\s*(?:الطلب|الاوردر|الأوردر)|غير\s*مضبوط|مش\s*مضبوط|مش\s*صح|غلطان|مش\s*طلبي|مش\s*ده\s*الي\s*انا\s*طلبته|مش\s*ده\s*اللي\s*طلبته|مش\s*ده\s*اللي\s*انا\s*طلبته|مش\s*ده\s*الي\s*طلبته|مش\s*ده\s*الي\s*طلبطه|طلبت\s*كيلو\s*واحد\s*فقط|مطلبتش\s*كل\s*ده)/i.test(
      text
    );
  }

  /**
   * Check if customer is inquiring about retail prices, retail catalog, or retail purchasing
   * E.g. "سعر القطاعي", "القطاعي بكام", "اسعار القطاعي", "بتبيعوا قطاعي", "في قطاعي", "متاح قطاعي", "سعر الكيلو قطاعي"
   */
  public isRetailInquiry(text: string): boolean {
    if (!text || text.length < 3) return false;
    return /(?:سعر\s*القطاعي|أسعار\s*القطاعي|اسعار\s*القطاعي|القطاعي\s*بكام|بكام\s*القطاعي|في\s*قطاعي|عندكم\s*قطاعي|متاح\s*قطاعي|بتبيعوا\s*قطاعي|بتبيعو\s*قطاعي|بيع\s*قطاعي|طلب\s*قطاعي|عاوز\s*قطاعي|عايز\s*قطاعي|شراء\s*قطاعي|القطاعي|قطاعي|تجزئة|سعر\s*التجزئة|أسعار\s*التجزئة|اسعار\s*التجزئة|بالقطعة|بالكيلو\s*قطاعي|كيلو\s*قطاعي|سعر\s*الكيلو|بكام\s*الكيلو|اقل\s*من\s*كرتونة|أقل\s*من\s*كرتونة)/i.test(
      text
    );
  }

  /**
   * Check if a product belongs to the Cheeses or Olive Oil category (the only products sold retail)
   */
  public isCheeseOrOliveOil(productName: string): boolean {
    if (!productName) return false;
    const p = productName.toLowerCase();
    return (
      p.includes("mozzarella") ||
      p.includes("موزاريلا") ||
      p.includes("موزريلا") ||
      p.includes("رومي") ||
      p.includes("roumy") ||
      p.includes("blend") ||
      p.includes("أجبان") ||
      p.includes("جبن") ||
      p.includes("جبنة") ||
      p.includes("olive") ||
      p.includes("زيت زيتون")
    );
  }

  /**
   * Check if an order is less than a carton (e.g. ordered by single kilo, single bottle/block, or < carton packaging)
   */
  public isOrderLessThanCarton(items: AIOrderItem[], text?: string): boolean {
    if (text && /(?:كرتونة|كراتين|شيكارة|شيكارات|جملة|توريد|تجارية)/i.test(text)) {
      return false;
    }
    if (!items || items.length === 0) {
      if (text && /(?:كيلو|كجم|قطاعي|تجزئة|علبة|قالب|زجاجة|أقل من كرتونة|اقل من كرتونة)/i.test(text)) {
        return true;
      }
      return false;
    }
    for (const it of items) {
      const pName = it.productName.toLowerCase();
      // Cheeses carton is usually 10kg or 5 blocks
      if (
        pName.includes("mozzarella") ||
        pName.includes("موزاريلا") ||
        pName.includes("رومي") ||
        pName.includes("blend") ||
        pName.includes("جبن")
      ) {
        if (pName.includes("block") || pName.includes("بلوك")) {
          if (it.quantity < 5) return true;
        } else {
          if (it.quantity < 10) return true;
        }
      }
      // Olive oil carton is 6 bottles
      if (pName.includes("olive") || pName.includes("زيت زيتون")) {
        if (it.quantity < 6) return true;
      }
      // Small quantities without explicit carton
      if (it.quantity < 5) return true;
    }
    if (text && /(?:كيلو|كجم|قطاعي|قالب|زجاجة)/i.test(text)) {
      return true;
    }
    return false;
  }

  /**
   * Adjust item prices for retail (Dynamically calculates wholesale price + 20 EGP markup)
   * NEVER uses hardcoded overrides so that any wholesale price change in knowledge base immediately reflects!
   */
  public adjustItemsForRetail(items: AIOrderItem[], isRetail: boolean): AIOrderItem[] {
    if (!isRetail) return items;
    return items.map((it) => {
      let unitPrice = it.unitPrice;
      if (this.isCheeseOrOliveOil(it.productName)) {
        unitPrice = this.getRetailUnitPrice(it.productName, it.unitPrice);
      }
      return {
        ...it,
        unitPrice,
        subtotal: unitPrice * it.quantity,
      };
    });
  }

  /**
   * Format retail catalog response dynamically based on active knowledge base products:
   * Cheeses and olive oil with +20 EGP increase over their current wholesale price.
   * Other products: "نعتذر هذا المنتج اقل كميه منه كرتونه"
   * And shows the 50 EGP shipping fee for orders less than a carton.
   */
  public formatRetailCatalogReply(): string {
    let reply = `🧀 *قائمة أسعار القطاعي والتجزئة لدى ${this.knowledge.companyName}:*\n\n`;
    reply += `أهلاً بحضرتك! نوفر البيع بالقطاعي لمنتجات الجبن الفاخرة وزيت الزيتون الطبيعي بزيادة ${this.RETAIL_CHEESE_AND_OIL_MARKUP} ج.م فقط عن سعر الجملة:\n\n`;

    const mozz100 = this.getProductByKeyword(/100%(?!.*block)/i);
    const mozzBlock = this.getProductByKeyword(/(?:بلوك|block)/i);
    const mozz75 = this.getProductByKeyword(/75%/i);
    const mozz50 = this.getProductByKeyword(/50%/i);
    const roumy = this.getProductByKeyword(/(?:رومي|roumy)/i);
    const oliveOil = this.getProductByKeyword(/(?:olive|زيت زيتون)/i);

    const p1Wholesale = mozz100?.price ?? 230;
    const p1Retail = this.getRetailUnitPrice(mozz100?.name || "جبنة موزاريلا 100%", p1Wholesale);

    const p2Wholesale = mozzBlock?.price ?? 550;
    const p2Retail = this.getRetailUnitPrice(mozzBlock?.name || "جبنة موزاريلا بلوك 100%", p2Wholesale);

    const p3Wholesale = mozz75?.price ?? 180;
    const p3Retail = this.getRetailUnitPrice(mozz75?.name || "جبنة موزاريلا 75%", p3Wholesale);

    const p4Wholesale = mozz50?.price ?? 155;
    const p4Retail = this.getRetailUnitPrice(mozz50?.name || "جبنة موزاريلا 50%", p4Wholesale);

    const p5Wholesale = roumy?.price ?? 215;
    const p5Retail = this.getRetailUnitPrice(roumy?.name || "جبنة رومي معتقة", p5Wholesale);

    const oilWholesale = oliveOil?.price ?? 1900;
    const oilRetail = this.getRetailUnitPrice(oliveOil?.name || "زيت زيتون", oilWholesale);

    reply += `1️⃣ *جبنة موزاريلا طبيعي 100% مبشور (Mozzarella 100%):*\n`;
    reply += `   💰 السعر: *${p1Retail} ج.م / كجم* (بدلاً من ${p1Wholesale} ج جملة)\n`;
    reply += `   ✨ طبيعي 100%، أعلى مطاطية وطعم غني ومميز للبيتزا والفطائر.\n\n`;

    reply += `2️⃣ *جبنة موزاريلا بلوك 100% قالب 2 كجم (Mozzarella Block):*\n`;
    reply += `   💰 السعر: *${p2Retail} ج.م / قالب* (بدلاً من ${p2Wholesale} ج جملة للقالب 2 كجم)\n`;
    reply += `   ✨ قالب شيفات احترافي عالي الجودة للتقطيع والتشريح.\n\n`;

    reply += `3️⃣ *جبنة موزاريلا 75% مبشور (Mozzarella 75%):*\n`;
    reply += `   💰 السعر: *${p3Retail} ج.م / كجم* (بدلاً من ${p3Wholesale} ج جملة)\n`;
    reply += `   ✨ مطاطية وأداء ممتاز للمطابخ ومطاعم الوجبات السريعة.\n\n`;

    reply += `4️⃣ *جبنة موزاريلا 50% مبشور (Mozzarella 50%):*\n`;
    reply += `   💰 السعر: *${p4Retail} ج.م / كجم* (بدلاً من ${p4Wholesale} ج جملة)\n`;
    reply += `   ✨ خيار اقتصادي ومثالي للمعجنات والسندوتشات.\n\n`;

    reply += `5️⃣ *جبنة رومي معتقة مبشورة (Roumy Grated):*\n`;
    reply += `   💰 السعر: *${p5Retail} ج.م / كجم* (بدلاً من ${p5Wholesale} ج جملة)\n`;
    reply += `   ✨ نكهة غنية أصيلة جاهزة للاستخدام الفوري للباستا والبيتزا.\n\n`;

    reply += `6️⃣ *زيت زيتون نقي (زجاجة 1 لتر):*\n`;
    reply += `   💰 السعر: *${oilRetail} ج.م / زجاجة 1 لتر*\n`;
    reply += `   ✨ زيت زيتون نقي فاخر للطهي والتتبيلات الإيطالية والسلطات.\n\n`;

    reply += `7️⃣ *مكسات الأجبان (مشكل • ثلاثي • ثنائي):*\n`;
    reply += `   💰 متوفرة بالقطاعي بالطلب مع زيادة ${this.RETAIL_CHEESE_AND_OIL_MARKUP} ج.م للعبوة.\n\n`;

    reply += `⛔ *تنويه هام بخصوص باقي المنتجات:*\n`;
    reply += `نعتذر لحضرتك، هذا المنتج أقل كمية منه كرتونة (الطماطم المقشرة الإيطالية سان مارزانو، الطماطم المجففة، الخل البلسميك، الصصوصات، الدقيق تايبو 00، والمخللات) ولا يتوفر منها بيع بالقطاعي.\n\n`;

    reply += `🚚 *مصاريف الشحن والتوصيل للقطاعي:*\n`;
    reply += `يتم إضافة **مصاريف شحن ${this.RETAIL_SHIPPING_FEE} ج.م** تلقائياً لأي طلب قطاعي (أقل من كرتونة) للتوصيل السريع والمبرد داخل القاهرة والجيزة.\n`;
    reply += `(بينما الشحن مجاني تماماً لطلبات الكرتونة والجملة الكاملة).\n\n`;

    reply += `🛒 *للطلب والتوصيل فوراً:* أرسل لنا الصنف والكمية المطلوبة مع اسمك وعنوانك وسنقوم بتسجيل الأوردر وتأكيده معك فوراً! 🌸`;

    return reply;
  }

  /**
   * Precise Product Item Extractor:
   * Maps customer requests to specific products without category explosion.
   * E.g. "موزاريلا سولو كيلو" -> ONLY Mozzarella 100% natural shredded (230 EGP), NOT all 4 variants!
   */
  public extractItemsFromOrderText(text: string): AIOrderItem[] {
    if (!text || text.length < 2) return [];

    const lines = text
      .split(/[\n\r]+/)
      .map((l) => l.trim())
      .filter(Boolean);
    const segments: string[] = [];
    for (const l of lines) {
      if (l.includes(" و ") && !/(?:شريف|شارع|عنوان)/i.test(l)) {
        segments.push(...l.split(" و "));
      } else {
        segments.push(l);
      }
    }

    const extractQty = (str: string): number => {
      const clean = str
        .replace(/\d+\s*%/g, " ")
        .replace(/(?:\+?20|0)?1[0125]\d{8}/g, " ");
      if (/(?:كيلوين|كرتونتين|علبتين|عبوتين|قالبين)/i.test(clean)) return 2;
      if (
        /(?:كيلو واحد|علبة واحدة|كرتونة واحدة|عبوة واحدة|قالب واحد)/i.test(clean)
      )
        return 1;
      const m1 = clean.match(
        /(\d{1,3})\s*(?:كيلو|كجم|علبة|علب|كرتونة|كراتين|عبوة|عبوات|قالب|قوالب|قطعة|قطع|ك)/i
      );
      if (m1 && parseInt(m1[1], 10) > 0) return parseInt(m1[1], 10);
      const m2 = clean.match(
        /(?:كيلو|كجم|علبة|علب|كرتونة|كراتين|عبوة|قالب|قطع|عدد)\s*(\d{1,3})/i
      );
      if (m2 && parseInt(m2[1], 10) > 0) return parseInt(m2[1], 10);
      const m3 = clean.match(
        /(\d{1,3})\s*(?:موزاريلا|جبنة|طماطم|زيت|خل|صوص|دقيق)/i
      );
      if (m3 && parseInt(m3[1], 10) > 0) return parseInt(m3[1], 10);
      return 1;
    };

    const items: AIOrderItem[] = [];
    const addedProductNames = new Set<string>();

    // 1. Mozzarella Category
    const mozSegment = segments.find(
      (s) =>
        /(?:موزاريلا|موزريلا|mozzarella|سولو)/i.test(s) &&
        !/(?:طماطم|زيتون|خيار)/i.test(s)
    );
    if (mozSegment) {
      const defProd = this.getProductByKeyword(/100%(?!.*block)/i);
      let name = defProd?.name || "Mozzarella Cheese — 100% (جبنة موزاريلا 100%)";
      let price = defProd?.price ?? 230;

      if (/(?:بلوك|block|قالب)/i.test(mozSegment)) {
        const blockProd = this.getProductByKeyword(/(?:بلوك|block)/i);
        name = blockProd?.name || "Mozzarella Cheese — 100% Block (جبنة موزاريلا بلوك 100%)";
        price = blockProd?.price ?? 550;
      } else if (/(?:75%|75|سبعين)/i.test(mozSegment)) {
        const p75 = this.getProductByKeyword(/75%/i);
        name = p75?.name || "Mozzarella Cheese — 75% (جبنة موزاريلا 75%)";
        price = p75?.price ?? 180;
      } else if (/(?:50%|50|خمسين)/i.test(mozSegment)) {
        const p50 = this.getProductByKeyword(/50%/i);
        name = p50?.name || "Mozzarella Cheese — 50% (جبنة موزاريلا 50%)";
        price = p50?.price ?? 155;
      } else if (/(?:ميكس للبيتزا|مكس للبيتزا|مكس بيتزا)/i.test(mozSegment)) {
        const pBlend = this.getProductByKeyword(/(?:ميكس للبيتزا|مكس للبيتزا)/i);
        name = pBlend?.name || "Mozzarella Cheese Blend (جبنة موزاريلا ميكس للبيتزا)";
        price = pBlend?.price ?? 0;
      }
      const qty = extractQty(mozSegment);
      items.push({
        productName: name,
        quantity: qty,
        unitPrice: price,
        subtotal: qty * price,
      });
      addedProductNames.add(name);
    }

    // 2. Tomatoes Category
    const tomSegment = segments.find((s) => /(?:طماطم|tomatoes)/i.test(s));
    if (tomSegment) {
      const pBella = this.getProductByKeyword(/(?:bella|سان مارزانو)/i);
      let name =
        pBella?.name || "Peeled Tomatoes — La Bella San Marzano (طماطم مقشرة إيطالية سان مارزانو)";
      let price = pBella?.price ?? 1650;
      if (/(?:عصير|كاملة)/i.test(tomSegment)) {
        const pJuice = this.getProductByKeyword(/(?:عصير طماطم|juice)/i);
        name =
          pJuice?.name || "Whole Peeled Tomatoes in Tomato Juice (طماطم كاملة مقشرة في عصير طماطم)";
        price = pJuice?.price ?? 1000;
      } else if (/(?:مجففة|مجففه)/i.test(tomSegment)) {
        if (/(?:1\s*كجم|1\s*كيلو|كيلو)/i.test(tomSegment)) {
          const pDry1kg = this.getProductByKeyword(/1kg|1 كجم/i);
          name =
            pDry1kg?.name || "Sun-Dried Tomatoes in Sunflower Oil 1kg (طماطم مجففة في زيت دوار الشمس 1 كجم)";
          price = pDry1kg?.price ?? 1450;
        } else {
          const pDry300g = this.getProductByKeyword(/300g|300 جم/i);
          name =
            pDry300g?.name || "Sun-Dried Tomatoes in Sunflower Oil 300g (طماطم مجففة في زيت دوار الشمس 300 جم)";
          price = pDry300g?.price ?? 950;
        }
      }
      const qty = extractQty(tomSegment);
      items.push({
        productName: name,
        quantity: qty,
        unitPrice: price,
        subtotal: qty * price,
      });
      addedProductNames.add(name);
    }

    // 3. Cheese Blends
    const blendSegment = segments.find(
      (s) =>
        /(?:مكس جبن|ميكس جبن|مكس أجبان|ميكس أجبان)/i.test(s) &&
        !addedProductNames.has(
          "Mozzarella Cheese Blend (جبنة موزاريلا ميكس للبيتزا)"
        )
    );
    if (blendSegment) {
      let name = "Mixed Cheese Blend (مكس جبن مشكل)";
      let price = 0;
      if (/(?:ثلاثي|رومي|إيمنتال|إيدام)/i.test(blendSegment)) {
        const pTriple = this.getProductByKeyword(/(?:ثلاثي|triple)/i);
        name =
          pTriple?.name || "Triple Cheese Blend (مكس أجبان ثلاثي - رومي • إيمنتال • إيدام)";
        price = pTriple?.price ?? 0;
      } else if (/(?:ثنائي|جودا|شيدر)/i.test(blendSegment)) {
        const pDouble = this.getProductByKeyword(/(?:ثنائي|double)/i);
        name = pDouble?.name || "Double Cheese Blend (مكس أجبان ثنائي - جودا • شيدر)";
        price = pDouble?.price ?? 0;
      } else {
        const pMixed = this.getProductByKeyword(/(?:مشكل|mixed)/i);
        name = pMixed?.name || name;
        price = pMixed?.price ?? 0;
      }
      const qty = extractQty(blendSegment);
      items.push({
        productName: name,
        quantity: qty,
        unitPrice: price,
        subtotal: qty * price,
      });
      addedProductNames.add(name);
    }

    // 4. Balsamic Vinegar
    const balSegment = segments.find((s) => /(?:بلسميك|balsamic|خل)/i.test(s));
    if (balSegment) {
      const pBals = this.getProductByKeyword(/(?:خل بلسميك(?!.*مودينا)|balsamic vinegar)/i);
      let name = pBals?.name || "Balsamic Vinegar (خل بلسميك)";
      let price = pBals?.price ?? 770;
      if (/(?:مودينا|معتق|modena)/i.test(balSegment)) {
        const pModena = this.getProductByKeyword(/(?:مودينا|modena)/i);
        name = pModena?.name || "Aceto Balsamico di Modena (خل بلسميك مودينا إيطالي معتق)";
        price = pModena?.price ?? 2550;
      }
      const qty = extractQty(balSegment);
      items.push({
        productName: name,
        quantity: qty,
        unitPrice: price,
        subtotal: qty * price,
      });
      addedProductNames.add(name);
    }

    // 5. Olive Oil
    const oilSegment = segments.find((s) => /(?:زيت زيتون|olive oil)/i.test(s));
    if (oilSegment) {
      const pOil = this.getProductByKeyword(/(?:زيت زيتون|olive oil)/i);
      const name = pOil?.name || "Olive Oil (زيت زيتون نقي)";
      const price = pOil?.price ?? 1900;
      const qty = extractQty(oilSegment);
      items.push({
        productName: name,
        quantity: qty,
        unitPrice: price,
        subtotal: qty * price,
      });
      addedProductNames.add(name);
    }

    // 6. Sauces
    const sauceSegment = segments.find(
      (s) => /(?:سيراتشا|سويت تشيلي|صويا|صوص)/i.test(s)
    );
    if (sauceSegment) {
      const pSriracha = this.getProductByKeyword(/(?:سيراتشا|sriracha)/i);
      let name = pSriracha?.name || "Sriracha Sauce (صوص سيراتشا حار)";
      let price = pSriracha?.price ?? 1250;
      if (/(?:سويت تشيلي|سويت شيلى)/i.test(sauceSegment)) {
        if (/(?:3\.4|جالون|جركن)/i.test(sauceSegment)) {
          const pSw3 = this.getProductByKeyword(/3\.4/i);
          name = pSw3?.name || "Sweet Chili Sauce 3.4kg (سويت تشيلي صوص 3.4 كجم جالون)";
          price = pSw3?.price ?? 990;
        } else {
          const pSw6 = this.getProductByKeyword(/600/i);
          name = pSw6?.name || "Sweet Chili Sauce 600g (سويت تشيلي صوص 600 جم)";
          price = pSw6?.price ?? 890;
        }
      } else if (/(?:صويا)/i.test(sauceSegment)) {
        const pSoy = this.getProductByKeyword(/(?:صويا|soy)/i);
        name = pSoy?.name || "Dark Soy Sauce (صويا صوص داكن)";
        price = pSoy?.price ?? 1350;
      }
      const qty = extractQty(sauceSegment);
      items.push({
        productName: name,
        quantity: qty,
        unitPrice: price,
        subtotal: qty * price,
      });
      addedProductNames.add(name);
    }

    // 7. Flour
    const flourSegment = segments.find(
      (s) => /(?:دقيق|طحين|00|تايبو|farina)/i.test(s)
    );
    if (flourSegment) {
      const pFlour = this.getProductByKeyword(/(?:دقيق|farina|00)/i);
      const name =
        pFlour?.name || "Farina di Grano Tenero — Tipo 00 (دقيق فاخر تايبو 00 للبيتزا والمخبوزات)";
      const price = pFlour?.price ?? 750;
      const qty = extractQty(flourSegment);
      items.push({
        productName: name,
        quantity: qty,
        unitPrice: price,
        subtotal: qty * price,
      });
      addedProductNames.add(name);
    }

    // 8. Pickles & Olives
    const pickleSegment = segments.find(
      (s) =>
        /(?:هالبينو|هلابينو|خيار مخلل|كلاماتا|زيتون)/i.test(s) &&
        !/(?:زيت زيتون)/i.test(s)
    );
    if (pickleSegment) {
      const pJal = this.getProductByKeyword(/(?:هالبينو|jalapeño)/i);
      let name = pJal?.name || "Jalapeño Peppers, Sliced (فلفل هالبينو شرائح)";
      let price = pJal?.price ?? 590;
      if (/(?:خيار)/i.test(pickleSegment)) {
        if (/(?:5)/i.test(pickleSegment)) {
          const pCuc5 = this.getProductByKeyword(/5kg|5 كجم/i);
          name = pCuc5?.name || "Cucumber, Sliced 5kg (خيار مخلل شرائح 5 كجم)";
          price = pCuc5?.price ?? 600;
        } else {
          const pCuc3 = this.getProductByKeyword(/3\.8/i);
          name = pCuc3?.name || "Cucumber, Sliced 3.8kg (خيار مخلل شرائح 3.8 كجم)";
          price = pCuc3?.price ?? 590;
        }
      } else if (/(?:كلاماتا|زيتون)/i.test(pickleSegment)) {
        const pKalamata = this.getProductByKeyword(/(?:كلاماتا|kalamata)/i);
        name = pKalamata?.name || "Kalamata Olives, Pitted (زيتون كلاماتا مخلي من النواة)";
        price = pKalamata?.price ?? 1220;
      }
      const qty = extractQty(pickleSegment);
      items.push({
        productName: name,
        quantity: qty,
        unitPrice: price,
        subtotal: qty * price,
      });
      addedProductNames.add(name);
    }

    return items;
  }

  public parseOrderDetailsFromText(
    text: string,
    defaultCustomerName: string = "عميل واتساب"
  ): {
    hasOrderData: boolean;
    customerName: string;
    shippingAddress: string;
    phone: string;
    items: AIOrderItem[];
    totalAmount: number;
    shippingFee?: number;
    isRetail?: boolean;
    hasLocation: boolean;
    locationUrl?: string;
  } | null {
    if (!text || text.length < 4) return null;

    // Reject objections/complaints immediately from regular order submission
    if (this.isOrderObjection(text)) {
      return null;
    }

    const lines = text
      .split(/[\n\r]+/)
      .map((l) => l.trim())
      .filter(Boolean);

    // 1. Phone number (010..., 011..., 012..., 015..., +20...)
    const phoneMatch = text.match(/(?:\+?20|0)?1[0125]\d{8}/);
    const extractedPhone = phoneMatch ? phoneMatch[0] : "";

    // 2. Address detection (Egyptian areas and street patterns)
    const addressRegex =
      /(?:العنوان|عنوان|حدائق|حلوان|المعادي|مدينة نصر|التجمع|الرحاب|مدينتي|الشروق|بدر|الدقي|المهندسين|الزمالك|العجوزة|الهرم|فيصل|أكتوبر|زايد|شبرا|المقطم|مصر الجديدة|النزهة|عين شمس|المرج|المطرية|العباسية|الوايلي|باب الشعرية|المنيل|وسط البلد|التحرير|روض الفرج|حدائق القبة|الزيتون|السلام|الخانكة|قليوب|بنها|طنطا|المنصورة|الزقازيق|الإسكندرية|الاسكندرية|السويس|الإسماعيلية|بورسعيد|دمياط|الفيوم|بني سويف|المنيا|أسيوط|سوهاج|قنا|الأقصر|أسوان|الغردقة|شرم الشيخ|شارع|\bش\s*\d+|عمارة|دور|شقة|ميدان|منطقة|حي)/i;

    let extractedAddress = "";
    const explicitAddressMatch = text.match(
      /(?:العنوان|عنواني|عنوان الاستلام|التوصيل إلى|التوصيل الي)\s*[:\-]?\s*([^\n\r]{3,100})/i
    );

    if (explicitAddressMatch && explicitAddressMatch[1]) {
      extractedAddress = explicitAddressMatch[1].trim();
    } else if (lines.length > 1) {
      // In multi-line message, search for address line
      const addrLine = lines.find(
        (l) =>
          addressRegex.test(l) &&
          !/(?:مطلبتش|مش|طلبت|عايز|عاوز|سولو|موزاريلا|جبنة|طماطم|زيت)/i.test(l)
      );
      if (addrLine && addrLine.length >= 3) {
        extractedAddress = addrLine;
      }
    } else if (addressRegex.test(text)) {
      const parts = text.split(/[\n\r,،\.]+/);
      const addrPart = parts.find(
        (p) =>
          addressRegex.test(p) &&
          !/(?:مطلبتش|مش|طلبت|عايز|عاوز|سولو|موزاريلا)/i.test(p)
      );
      if (addrPart && addrPart.trim().length >= 4) {
        extractedAddress = addrPart.trim();
      }
    }

    // Sanitize address to never contain objection words
    if (/(?:مطلبتش|مش\s*ده|غلط|طلبت|عايز)/i.test(extractedAddress)) {
      extractedAddress = "";
    }

    // 3. Customer name detection
    let extractedName = "";
    const explicitNameMatch = text.match(
      /(?:الاسم|الاسم بالكامل|اسم العميل|اسمي|اسمى)\s*[:\-]?\s*([^\n\r,\.،]{2,30})/i
    );

    if (explicitNameMatch && explicitNameMatch[1]) {
      const cand = explicitNameMatch[1].trim();
      if (
        !/(?:مطلبتش|طلبت|عايز|عاوز|مش|هو|في|على|من|لا|بس|كيلو|كرتونة)/i.test(
          cand
        )
      ) {
        extractedName = cand;
      }
    }

    if (!extractedName && lines.length > 1) {
      // Check multi-line message for a line that is a person name (2-4 words, Arabic, no digits, no address, no product)
      const nameCandidate = lines.find((l) => {
        if (/(?:\+?20|0)?1[0125]\d{8}/.test(l)) return false;
        if (addressRegex.test(l)) return false;
        if (
          /(?:موزاريلا|سولو|جبنة|طماطم|زيت|خل|صوص|دقيق|كيلو|كرتونة|علبة|كجم|طلب|اوردر)/i.test(
            l
          )
        )
          return false;
        if (/(?:مطلبتش|طلبت|عايز|عاوز|مش|في|على|من|لا|بس)/i.test(l))
          return false;
        const words = l.split(/\s+/).filter(Boolean);
        return (
          words.length >= 2 &&
          words.length <= 4 &&
          /^[\u0600-\u06FF\s]+$/.test(l)
        );
      });
      if (nameCandidate) {
        extractedName = nameCandidate.trim();
      }
    }

    if (
      !extractedName ||
      /(?:مطلبتش|طلبت|عايز|عاوز|مش|هو|في|على|من|لا|بس|كيلو)/i.test(
        extractedName
      )
    ) {
      extractedName =
        defaultCustomerName &&
        !/(?:مطلبتش|طلبت|عايز|عاوز|مش)/i.test(defaultCustomerName)
          ? defaultCustomerName
          : "عميل واتساب";
    }

    // 4. Products matching using precise extractor
    const items = this.extractItemsFromOrderText(text);

    // Fallback if generic order words exist without named products
    if (items.length === 0) {
      if (
        /(?:كرتونة|كراتين|علبة|طلب|اوردر|أوردر|شراء|حجز)/i.test(text) &&
        !/(?:بكم|بكام|كم\s*سعر)/i.test(text)
      ) {
        const fallbackProd = (this.knowledge.products || [])[0];
        const defaultName = fallbackProd
          ? fallbackProd.name
          : "طلب منتجات سولو";
        const defaultPrice = fallbackProd ? fallbackProd.price : 0;
        let qty = 1;
        const qtyMatch = text.match(/(\d+)\s*(?:كرتونة|كراتين|علبة|قطع)/i);
        if (qtyMatch && qtyMatch[1]) {
          qty = Math.max(1, parseInt(qtyMatch[1], 10) || 1);
        }
        items.push({
          productName: defaultName,
          quantity: qty,
          unitPrice: defaultPrice,
          subtotal: qty * defaultPrice,
        });
      }
    }

    const hasOrderAction =
      /(?:طلب|اطلب|عايز|عاوز|اريد|احجز|تأكيد|تاكيد|شراء|اشتري|اوردر|أوردر|ابعتلي|ارسل|هاتلي|كرتونة|كراتين|علبة|علب|كيلو)/i.test(
        text
      );
    const hasAddressCue = Boolean(extractedAddress) || addressRegex.test(text);
    const hasOrderIntent =
      (items.length > 0 &&
        (hasOrderAction ||
          Boolean(extractedAddress) ||
          Boolean(extractedPhone))) ||
      /(?:تأكيد|تاكيد|تثبيت|تسجيل)\s*(?:اوردر|الأوردر|الاوردر|الطلب|طلب)/i.test(
        text
      ) ||
      Boolean(extractedPhone && (hasAddressCue || extractedAddress));

    // Pure inquiry check
    const isPureInquiry =
      /(?:بكم|بكام|كم\s*سعر|ما\s*هو\s*سعر|سعره\s*كام|سعرها\s*كام|كام\s*سعر|هل\s*متوفر|متاح|تفاصيل|مواصفات)/i.test(
        text
      ) &&
      !/(?:عايز\s*اطلب|اريد\s*طلب|احجز|تأكيد|تاكيد|اشتري|اشترى|ابعتلي|ارسل\s*لي)/i.test(
        text
      ) &&
      !extractedPhone;

    if (isPureInquiry || !hasOrderIntent || items.length === 0) {
      return null;
    }

    const locationInfo = this.extractLocationFromText(text);
    const isLessThanCarton = this.isOrderLessThanCarton(items, text);
    const adjustedItems = this.adjustItemsForRetail(items, isLessThanCarton);
    const itemsSubtotal = adjustedItems.reduce((sum, it) => sum + it.subtotal, 0);
    const shippingFee = isLessThanCarton ? this.RETAIL_SHIPPING_FEE : 0;
    const totalAmount = itemsSubtotal + shippingFee;

    return {
      hasOrderData: true,
      customerName: extractedName,
      shippingAddress:
        extractedAddress ||
        (hasAddressCue ? "العنوان مذكور في المحادثة" : "سيتم التأكيد عبر الهاتف"),
      phone: extractedPhone,
      items: adjustedItems,
      totalAmount,
      shippingFee,
      isRetail: isLessThanCarton,
      hasLocation: locationInfo.hasLocation,
      locationUrl:
        locationInfo.locationUrl ||
        (locationInfo.hasLocation ? locationInfo.locationText : undefined),
    };
  }

  /**
   * Dedicated handler for customer order objections, complaints, and corrections.
   * Solves: "في غلطه كبيره حصلت اني عملت اوردر من رقم تاني عباره عن عاوز كيلو موزاريلا وراح عملي هو اوردر كبير ملهوش دعوه بالي اتطلب وده طبعا مصيبه وثانيا لما قولتله مش ده الي انا طلبطه راح حاطط الجمله دي مكان العنوان وبرضه اكد الاورد الي هو عامله لازم يتعامل بذكاء في الموضوع ده"
   */
  public handleOrderObjection(params: {
    message: string;
    phone: string;
    cleanPhone: string;
    session: AIAgentSession;
    accountId: string;
  }): {
    handled: boolean;
    replyText: string;
    intent: AILeadIntent;
    leadScore: number;
    leadQuality: AILeadQuality;
    orderStatus: AIOrder["status"];
    order?: AIOrder;
    memorySummary: string;
  } {
    const { message, cleanPhone, session } = params;

    // Find any active order (draft or confirmed)
    const existingOrder = this.orders.find(
      (o) =>
        o.phone === cleanPhone &&
        (o.status === "draft" || o.status === "confirmed")
    );

    const isCancellation =
      /(?:الغِ|إلغاء|الغاء|كنسل|مش\s*عايز\s*خلاص|مش\s*عايز\s*حاجة|بلاش)/i.test(
        message
      ) && !/(?:عايز|طلبت|طلب|موزاريلا|كرتونة|كيلو)/i.test(message);

    if (isCancellation && existingOrder) {
      // Requirement: Cancelled orders must be completely deleted!
      const cancelledId = existingOrder.id;
      this.deleteOrder(cancelledId);

      this.addLog({
        phone: cleanPhone,
        type: "order_updated",
        title: `إلغاء ومسح الأوردر #${cancelledId} نهائياً بناءً على طلب العميل`,
        details: `طلب العميل إلغاء طلبه، وتم مسح الأوردر تماماً من النظام وقاعدة البيانات فوراً وتقديم الاعتذار له.`,
      });

      const replyText =
        `بعتذر لحضرتك جداً على أي إزعاج يا فندم وحقك عليا تماماً 🙏🌸\n` +
        `تم إلغاء وحذف الأوردر #${cancelledId} نهائياً كما طلبت.\n\n` +
        `يسعدنا دائماً خدمتك في أي وقت، وإذا رغبت في أي استفسار أو مساعدة يمكنك إرسال رقم 4 للتحدث مع خدمة العملاء.`;

      return {
        handled: true,
        replyText,
        intent: "support",
        leadScore: 50,
        leadQuality: "warm",
        orderStatus: "cancelled",
        order: { ...existingOrder, status: "cancelled" },
        memorySummary: `قام العميل بإلغاء الأوردر #${cancelledId} وتم مسحه وحذفه نهائياً والاعتذار له فوراً`,
      };
    }

    // Check if the customer specified what they actually wanted (e.g. "انا طلبت كيلو واحد فقط موزاريلا مبشوره طبيعي")
    const correctedItems = this.extractItemsFromOrderText(message);

    if (correctedItems.length > 0 && existingOrder) {
      const isLessCarton = this.isOrderLessThanCarton(correctedItems, message);
      const adjustedItems = this.adjustItemsForRetail(correctedItems, isLessCarton);
      const itemsSubtotal = adjustedItems.reduce(
        (sum, it) => sum + it.subtotal,
        0
      );
      const shippingFee = isLessCarton ? this.RETAIL_SHIPPING_FEE : 0;
      const correctedTotal = itemsSubtotal + shippingFee;

      existingOrder.items = adjustedItems;
      existingOrder.shippingFee = shippingFee;
      existingOrder.isRetail = isLessCarton;
      existingOrder.totalAmount = correctedTotal;

      // Clean up customer name and address if they accidentally contained complaint text
      if (
        !existingOrder.customerName ||
        /(?:مطلبتش|طلبت|عايز|مش|غلط)/i.test(existingOrder.customerName)
      ) {
        existingOrder.customerName =
          session.name && !/(?:مطلبتش|طلبت|عايز|مش)/i.test(session.name)
            ? session.name
            : "عميلنا العزيز";
      }

      if (
        !existingOrder.shippingAddress ||
        /(?:مطلبتش|طلبت|مش|غلط|شكوى)/i.test(existingOrder.shippingAddress)
      ) {
        existingOrder.shippingAddress = "حدائق حلوان";
      }

      existingOrder.notes = isLessCarton
        ? "تم تصحيح الأوردر فوراً ليطابق رغبة العميل (أقل من كرتونة - قطاعي مع مصاريف الشحن)"
        : "تم تصحيح الأوردر فوراً ليطابق رغبة العميل (جملة)";
      existingOrder.updatedAt = new Date().toISOString();
      this.saveOrders();

      this.addLog({
        phone: cleanPhone,
        type: "order_updated",
        title: `تصحيح الأوردر #${existingOrder.id}`,
        details: `تم تصحيح عناصر الأوردر لتصبح بقيمة ${correctedTotal} ${existingOrder.currency} شامل الشحن طبقاً لتصحيح العميل.`,
      });

      const itemsText = adjustedItems
        .map(
          (it) =>
            `• *${it.productName}* × ${it.quantity} (${it.subtotal} ${existingOrder.currency}${isLessCarton ? " - سعر قطاعي" : ""})`
        )
        .join("\n");

      let financialBreakdown = `💰 *الإجمالي الصحيح:* ${correctedTotal} ${existingOrder.currency}`;
      if (shippingFee > 0) {
        financialBreakdown =
          `💰 *إجمالي المنتجات:* ${itemsSubtotal} ${existingOrder.currency}\n` +
          `🚚 *مصاريف الشحن والتوصيل (للطلب أقل من كرتونة):* ${shippingFee} ${existingOrder.currency}\n` +
          `💵 *الإجمالي النهائي شامل الشحن:* ${correctedTotal} ${existingOrder.currency}`;
      }

      const replyText =
        `حقك عليا جداً وبعتذر لحضرتك على أي لبس أو خطأ غير مقصود يا ${existingOrder.customerName}! 🙏🌸\n` +
        `تم تصحيح وتعديل الأوردر فوراً ليطابق طلبك بدقة:\n\n` +
        `📋 *ملخص الطلب بعد التصحيح (#${existingOrder.id}):*\n` +
        `${itemsText}\n` +
        `${financialBreakdown}\n` +
        `🏠 *العنوان:* ${existingOrder.shippingAddress}\n` +
        `📞 *رقم الهاتف:* ${existingOrder.phone}\n\n` +
        (existingOrder.status === "confirmed" && existingOrder.locationUrl
          ? `📍 *اللوكيشن مثبت لديك بالفعل* وسيتم تسليم الطلب وفقاً له.\n`
          : `📍 *خطوة أخيرة لتأكيد الأوردر:*\nفضلاً قم بإرسال *اللوكيشن الخاص بك* (Location عبر واتساب 📍 أو رابط خرائط جوجل) لتسهيل وتأكيد سرعة الاستلام والتوصيل! 🚚\n`) +
        `يسعدنا دائماً خدمتك ورضاك أولويتنا الدائمة 🌸`;

      return {
        handled: true,
        replyText,
        intent: "purchasing",
        leadScore: 95,
        leadQuality: "hot",
        orderStatus: existingOrder.status,
        order: existingOrder,
        memorySummary: `تم تصحيح الأوردر #${existingOrder.id} فوراً بالكمية المطلوبة (${correctedTotal} ${existingOrder.currency}) والاعتذار للعميل`,
      };
    }

    if (existingOrder) {
      // General objection without specifying details (e.g. "مش ده الي انا طلبطه" or "الطلب غلط")
      const replyText =
        `حقك عليا جداً وبعتذر لحضرتك على أي خطأ أو لبس غير مقصود يا فندم! 🙏🌸\n` +
        `فضلاً وضح لي المنتجات أو الكميات الصحيحة اللي تحب نسجلها لحضرتك وهنعدل الأوردر #${existingOrder.id} في ثواني معدودة،\n` +
        `أو يمكنك إرسال رقم 4 للتحويل فوراً إلى أحد ممثلي خدمة العملاء للرد عليك ومساعدتك بدقة.`;

      return {
        handled: true,
        replyText,
        intent: "support",
        leadScore: 70,
        leadQuality: "warm",
        orderStatus: existingOrder.status,
        order: existingOrder,
        memorySummary: `أبدى العميل اعتراضاً على تفاصيل الأوردر #${existingOrder.id} وطُلب منه التوضيح أو التحويل لموظف بشري`,
      };
    }

    // No existing order found
    const replyText =
      `بعتذر لحضرتك جداً على أي سوء تفاهم يا فندم 🙏🌸. لم يتم تسجيل أي أوردر لحسابك حتى الآن.\n` +
      `يمكنك توضيح استفسارك أو المنتجات التي ترغب في طلبها ويسعدنا خدمتك فوراً، أو إرسال رقم 4 للتحدث مع خدمة العملاء.`;

    return {
      handled: true,
      replyText,
      intent: "support",
      leadScore: 50,
      leadQuality: "neutral" as any,
      orderStatus: "draft",
      memorySummary: `اعتذر الوكيل للعميل عن أي سوء تفاهم وأكد عدم وجود أوردر مسجل`,
    };
  }

  public handleOrderAndLocationFlow(params: {
    message: string;
    phone: string;
    session: AIAgentSession;
    accountId: string;
  }): {
    handled: boolean;
    replyText: string;
    intent: AILeadIntent;
    leadScore: number;
    leadQuality: AILeadQuality;
    orderStatus?: AIOrderStatus;
    order?: AIOrder;
    isWaitingForLocation?: boolean;
    isLocationConfirmed?: boolean;
    memorySummary?: string;
    wantsHumanAgent?: boolean;
    sentiment?: "positive" | "neutral" | "negative";
  } | null {
    const { message, phone, session } = params;
    const cleanPhone = normalizePhoneNumber(phone);

    // BRANCH 0: Customer objection, correction, complaint, or cancellation
    if (this.isOrderObjection(message)) {
      return this.handleOrderObjection({
        message,
        phone,
        cleanPhone,
        session,
        accountId: params.accountId,
      });
    }

    const locationInfo = this.extractLocationFromText(message);

    // 1. Check if customer has an existing pending/draft order waiting for location
    const existingDraft = this.orders.find(
      (o) => o.phone === cleanPhone && o.status === "draft"
    );

    // BRANCH 1: Customer sends their location for a pending draft order
    if (locationInfo.hasLocation && existingDraft) {
      const locUrl = locationInfo.locationUrl || locationInfo.locationText || "";
      existingDraft.locationUrl = locUrl;
      if (locationInfo.coordinates) {
        existingDraft.locationCoordinates = locationInfo.coordinates;
      }
      existingDraft.status = "confirmed";
      existingDraft.updatedAt = new Date().toISOString();
      if (
        locationInfo.locationUrl &&
        !existingDraft.shippingAddress.includes(locationInfo.locationUrl)
      ) {
        existingDraft.shippingAddress = existingDraft.shippingAddress
          ? `${existingDraft.shippingAddress} (📍 اللوكيشن: ${locationInfo.locationUrl})`
          : locationInfo.locationUrl;
      }
      this.saveOrders();

      this.addLog({
        phone: cleanPhone,
        type: "order_updated",
        title: `تم استلام اللوكيشن وتأكيد الأوردر #${existingDraft.id}`,
        details: `استلم الوكيل الذكي موقع العميل وتم تأكيد الأوردر بقيمة ${existingDraft.totalAmount} ${existingDraft.currency} للعميل ${existingDraft.customerName}`,
      });

      const isLess = this.isOrderLessThanCarton(existingDraft.items);
      const shippingFee =
        existingDraft.shippingFee !== undefined
          ? existingDraft.shippingFee
          : isLess
          ? this.RETAIL_SHIPPING_FEE
          : 0;
      const itemsSubtotal = existingDraft.items.reduce(
        (s, it) => s + (it.subtotal || it.unitPrice * it.quantity),
        0
      );

      const itemsText =
        existingDraft.items.length > 0
          ? existingDraft.items
              .map(
                (it) =>
                  `• *${it.productName}* × ${it.quantity} (${
                    it.subtotal || it.unitPrice * it.quantity
                  } ${existingDraft.currency}${isLess ? " - سعر قطاعي" : ""})`
              )
              .join("\n")
          : "• المنتجات المسجلة في طلبك";

      let priceBreakdown = `💰 *الإجمالي:* ${existingDraft.totalAmount} ${existingDraft.currency}`;
      if (shippingFee > 0) {
        priceBreakdown =
          `💰 *إجمالي المنتجات:* ${itemsSubtotal} ${existingDraft.currency}\n` +
          `🚚 *مصاريف الشحن والتوصيل (للطلب أقل من كرتونة):* ${shippingFee} ${existingDraft.currency}\n` +
          `💵 *الإجمالي النهائي شامل الشحن:* ${existingDraft.totalAmount} ${existingDraft.currency}`;
      }

      const replyText =
        `شكراً جزيلاً لحضرتك يا ${existingDraft.customerName}! تم استلام اللوكيشن وتأكيد الأوردر بنجاح 🎉📦\n\n` +
        `✅ *تفاصيل الأوردر المؤكد #${existingDraft.id}:*\n` +
        `${itemsText}\n` +
        `${priceBreakdown}\n` +
        `📍 *موقع الاستلام (اللوكيشن):* تم تثبيت موقعك بدقة لتسهيل وتأكيد سرعة التوصيل 📍\n` +
        `🏠 *العنوان:* ${existingDraft.shippingAddress}\n\n` +
        `🚚 سيقوم مندوب الشحن والتوصيل بالتواصل معك هاتفياً لتسليم الطلب في أسرع وقت ممكن.\n` +
        `شكراً جزيلاً لتعاملك مع ${this.knowledge.companyName}، ويسعدنا دائماً خدمتك! 🌸`;

      return {
        handled: true,
        replyText,
        intent: "purchasing",
        leadScore: 100,
        leadQuality: "hot",
        orderStatus: "confirmed",
        order: existingDraft,
        isLocationConfirmed: true,
      };
    }

    // BRANCH 2: Customer is submitting their order details (with or without location)
    const orderSubmission = this.parseOrderDetailsFromText(message, session.name);
    if (orderSubmission && orderSubmission.hasOrderData) {
      // Check if customer is attempting to order ONLY non-cheese/non-oil items in retail / less than a carton quantity
      const allNonRetail = orderSubmission.items.every(
        (it) => !this.isCheeseOrOliveOil(it.productName)
      );
      if (allNonRetail && orderSubmission.isRetail) {
        const prodNames = orderSubmission.items
          .map((it) => it.productName)
          .join("، ");
        const replyText =
          `أهلاً بحضرتك يا فندم! 🌸\n` +
          `نعتذر لحضرتك جداً، هذا المنتج (${prodNames}) **أقل كمية متاحة منه هي كرتونة كاملة** (بيع وتوريدات جملة فقط)، ولا يتوفر منه بيع بالقطاعي أو بالعبوة الفردية.\n\n` +
          `🧀 *المتوفر لدينا بالقطاعي والتجزئة:* منتجات الجبن الفاخرة (الموزاريلا، الرومي، ومكس الأجبان) وزيت الزيتون النقي بزيادة 20 ج.م فقط عن سعر الجملة للكيلو، مع إضافة 50 ج.م مصاريف شحن للطلبات أقل من كرتونة.\n\n` +
          `🛒 إذا كنت ترغب في حجز كرتونة كاملة جملة، يسعدنا خدمتك وتأكيد طلبك فوراً!`;

        return {
          handled: true,
          replyText,
          intent: "inquiry",
          leadScore: 60,
          leadQuality: "warm",
          wantsHumanAgent: false,
        };
      }

      const orderPhone = orderSubmission.phone || cleanPhone;
      const orderCustName =
        orderSubmission.customerName && orderSubmission.customerName !== "عميل واتساب"
          ? orderSubmission.customerName
          : session.name;

      if (orderSubmission.hasLocation) {
        // Customer provided both order data AND location in this message!
        const confirmedOrder = this.createOrUpdateOrder({
          phone: orderPhone,
          customerName: orderCustName,
          items: orderSubmission.items,
          totalAmount: orderSubmission.totalAmount,
          shippingFee: orderSubmission.shippingFee || 0,
          isRetail: orderSubmission.isRetail || false,
          currency: this.knowledge.currency,
          shippingAddress: orderSubmission.shippingAddress,
          locationUrl: orderSubmission.locationUrl,
          paymentMethod: "الدفع عند الاستلام",
          status: "confirmed",
        });

        const isLess = orderSubmission.isRetail || false;
        const shippingFee = orderSubmission.shippingFee || 0;
        const itemsSubtotal = orderSubmission.items.reduce(
          (s, it) => s + it.subtotal,
          0
        );

        const itemsText =
          confirmedOrder.items.length > 0
            ? confirmedOrder.items
                .map(
                  (it) =>
                    `• *${it.productName}* × ${it.quantity} (${it.subtotal} ${confirmedOrder.currency}${isLess ? " - سعر قطاعي" : ""})`
                )
                .join("\n")
            : "• تم تسجيل طلبك";

        let priceBreakdown = `💰 *الإجمالي:* ${confirmedOrder.totalAmount} ${confirmedOrder.currency}`;
        if (shippingFee > 0) {
          priceBreakdown =
            `💰 *إجمالي المنتجات:* ${itemsSubtotal} ${confirmedOrder.currency}\n` +
            `🚚 *مصاريف الشحن والتوصيل (للطلب أقل من كرتونة):* ${shippingFee} ${confirmedOrder.currency}\n` +
            `💵 *الإجمالي النهائي شامل الشحن:* ${confirmedOrder.totalAmount} ${confirmedOrder.currency}`;
        }

        const replyText =
          `شكراً جزيلاً لحضرتك يا ${confirmedOrder.customerName}! تم استلام بياناتك واللوكيشن وتأكيد الأوردر بنجاح 🎉📦\n\n` +
          `✅ *تفاصيل الأوردر المؤكد #${confirmedOrder.id}:*\n` +
          `${itemsText}\n` +
          `${priceBreakdown}\n` +
          `📍 *موقع الاستلام (اللوكيشن):* تم تثبيت موقعك بدقة لتسهيل الاستلام والتوصيل 📍\n` +
          `🏠 *العنوان:* ${confirmedOrder.shippingAddress}\n\n` +
          `🚚 سيتواصل معك مندوب الشحن والتسليم هاتفياً لتسليم الطلب في أسرع وقت.\n` +
          `شكراً لثقتك في ${this.knowledge.companyName}، ويسعدنا دائماً خدمتك! 🌸`;

        return {
          handled: true,
          replyText,
          intent: "purchasing",
          leadScore: 100,
          leadQuality: "hot",
          orderStatus: "confirmed",
          order: confirmedOrder,
          isLocationConfirmed: true,
        };
      } else {
        // Customer provided order data BUT NO LOCATION YET:
        // Save as draft, and ask the customer to send their location to facilitate delivery!
        const draftOrder = this.createOrUpdateOrder({
          phone: orderPhone,
          customerName: orderCustName,
          items: orderSubmission.items,
          totalAmount: orderSubmission.totalAmount,
          shippingFee: orderSubmission.shippingFee || 0,
          isRetail: orderSubmission.isRetail || false,
          currency: this.knowledge.currency,
          shippingAddress: orderSubmission.shippingAddress,
          paymentMethod: "الدفع عند الاستلام",
          status: "draft",
        });

        const isLess = orderSubmission.isRetail || false;
        const shippingFee = orderSubmission.shippingFee || 0;
        const itemsSubtotal = orderSubmission.items.reduce(
          (s, it) => s + it.subtotal,
          0
        );

        const itemsText =
          draftOrder.items.length > 0
            ? draftOrder.items
                .map(
                  (it) =>
                    `• *${it.productName}* × ${it.quantity} (${it.subtotal} ${draftOrder.currency}${isLess ? " - سعر قطاعي" : ""})`
                )
                .join("\n")
            : "• المنتجات المطلوبة";

        let priceBreakdown = `💰 *الإجمالي التقديري:* ${draftOrder.totalAmount} ${draftOrder.currency}`;
        if (shippingFee > 0) {
          priceBreakdown =
            `💰 *إجمالي المنتجات:* ${itemsSubtotal} ${draftOrder.currency}\n` +
            `🚚 *مصاريف الشحن والتوصيل (للطلب أقل من كرتونة):* ${shippingFee} ${draftOrder.currency}\n` +
            `💵 *الإجمالي النهائي شامل الشحن:* ${draftOrder.totalAmount} ${draftOrder.currency}`;
        }

        const replyText =
          `شكراً جزيلاً لحضرتك يا ${draftOrder.customerName}! تم استلام وتسجيل بيانات الأوردر بنجاح 🌸📦\n\n` +
          `📋 *ملخص بيانات الطلب:* \n` +
          `${itemsText}\n` +
          `${priceBreakdown}\n` +
          `🏠 *العنوان:* ${draftOrder.shippingAddress}\n` +
          (orderSubmission.phone ? `📞 *رقم الهاتف:* ${orderSubmission.phone}\n\n` : "\n") +
          `📍 *خطوة أخيرة لتأكيد الأوردر:*\n` +
          `فضلاً قم بإرسال *اللوكيشن الخاص بك* (Location عبر خاصية مشاركة الموقع في واتساب 📍 أو رابط خرائط جوجل) لتسهيل عملية الاستلام وتوجيه مندوب التوصيل لمكانك بدقة وسرعة! 🚚`;

        return {
          handled: true,
          replyText,
          intent: "purchasing",
          leadScore: 90,
          leadQuality: "hot",
          orderStatus: "draft",
          order: draftOrder,
          isWaitingForLocation: true,
        };
      }
    }

    // BRANCH 3: Customer sends location without an existing draft order
    if (locationInfo.hasLocation) {
      const anyExisting = this.orders.find((o) => o.phone === cleanPhone);
      if (anyExisting) {
        anyExisting.locationUrl = locationInfo.locationUrl || locationInfo.locationText;
        anyExisting.status = "confirmed";
        anyExisting.updatedAt = new Date().toISOString();
        this.saveOrders();

        const replyText =
          `شكراً جزيلاً لحضرتك يا ${anyExisting.customerName}! تم استلام وتحديث اللوكيشن الخاص بك بنجاح لتسهيل الاستلام وتأكيد طلبك 📍🎉\n\n` +
          `سيتواصل معك فريق التوصيل لتسليم الأوردر بدقة في أسرع وقت. يسعدنا دائماً خدمتك! 🌸`;

        return {
          handled: true,
          replyText,
          intent: "purchasing",
          leadScore: 95,
          leadQuality: "hot",
          orderStatus: "confirmed",
          order: anyExisting,
          isLocationConfirmed: true,
        };
      }
    }

    return null;
  }

  public getLogs(limit = 100): AIAgentActivityLog[] {
    return this.logs.slice(0, limit);
  }

  public getStats(): AIAgentDashboardStats {
    const sessionsList = Array.from(this.sessions.values());
    const totalConversations = sessionsList.length;
    const activeAiChats = sessionsList.filter((s) => s.status === "active").length;
    const humanTakeovers = sessionsList.filter((s) => s.status === "human_takeover").length;

    let hotLeadsCount = 0;
    let warmLeadsCount = 0;
    let coldLeadsCount = 0;

    sessionsList.forEach((s) => {
      if (s.leadQuality === "hot" || s.leadScore >= 70) hotLeadsCount++;
      else if (s.leadQuality === "warm" || s.leadScore >= 40) warmLeadsCount++;
      else coldLeadsCount++;
    });

    const totalOrders = this.orders.length;
    const totalOrderValue = this.orders.reduce(
      (sum, o) => sum + (Number(o.totalAmount) || 0),
      0
    );

    const now = Date.now();
    const cleanSentTimestamps = this.recentSentTimestamps.filter((t) => now - t <= 60_000);
    const circuitBreakerRemainingSeconds =
      this.circuitBreakerTripped && this.circuitBreakerCooldownUntil > now
        ? Math.ceil((this.circuitBreakerCooldownUntil - now) / 1000)
        : 0;

    return {
      enabled: this.settings.enabled,
      totalConversations,
      activeAiChats,
      humanTakeovers,
      totalOrders,
      totalOrderValue,
      hotLeadsCount,
      warmLeadsCount,
      coldLeadsCount,
      currency: this.knowledge.currency,
      antiBanStatus: {
        safeQueueLength: this.outgoingSafeQueue.length,
        repliesInLastMinute: cleanSentTimestamps.length,
        maxRepliesPerMinute: this.settings.maxRepliesPerMinute || 3,
        circuitBreakerTripped: this.circuitBreakerTripped && circuitBreakerRemainingSeconds > 0,
        circuitBreakerRemainingSeconds,
        cooldownActive: this.outgoingSafeQueue.length > 0 || this.isProcessingQueue,
      },
    };
  }

  public resetCircuitBreaker(): boolean {
    this.circuitBreakerTripped = false;
    this.circuitBreakerCooldownUntil = 0;
    this.recentIncomingTimestamps = [];
    this.addLog({
      phone: "system",
      type: "safety_paused",
      title: "تمت إعادة ضبط قاطع الأمان يدوياً",
      details: "تم فك التجميد الأمني لقاطع الطوارئ واستئناف الردود التلقائية.",
    });
    return true;
  }

  // --- Interactive Customer Options Menu Helpers ---
  public getInteractiveMenuText(): string {
    if (this.settings.optionsMenuPrompt && this.settings.optionsMenuPrompt.trim()) {
      return this.settings.optionsMenuPrompt.trim();
    }
    return [
      "1️⃣ استعراض المنتجات والأسعار (أسعار جملة) 📦",
      "2️⃣ تفاصيل الشحن وطرق الدفع والضمان 🚚",
      "3️⃣ طلب وتأكيد أوردر جديد 🛒",
      "4️⃣ التحدث مع خدمة العملاء 👨‍💼",
    ].join("\n");
  }

  public getGuidedOptionsFooter(): string {
    return "\n\n💡 يمكنك الرد باختيار:\n1️⃣ المنتجات والأسعار (جملة) | 2️⃣ الشحن والدفع | 3️⃣ طلب أوردر | 4️⃣ خدمة العملاء";
  }

  // --- Real-time WhatsApp Incoming Message Hook ---

  public async onIncomingWhatsAppMessage(params: {
    messageId: string;
    phone: string;
    text: string;
    senderName?: string;
    accountId?: string;
    accountName?: string;
    fromMe: boolean;
    messageTimestamp?: number;
  }) {
    if (params.fromMe) return; // ignore outgoing messages
    if (!params.text || params.text.trim().length === 0) return;

    // 1. Check deduplication
    if (this.processedMessageIds.has(params.messageId)) {
      return;
    }
    this.processedMessageIds.add(params.messageId);
    // Limit memory set
    if (this.processedMessageIds.size > 2000) {
      const it = this.processedMessageIds.values();
      for (let i = 0; i < 500; i++) {
        this.processedMessageIds.delete(it.next().value!);
      }
    }

    const cleanPhone = normalizePhoneNumber(params.phone);
    if (!cleanPhone || cleanPhone.length < 7) return;

    // 0. Strict New-Messages-Only Filter:
    // Respect user requirement: "انا مش عاوزه يبعت للرسائل القديمه الي حتتبعت جديده بس"
    // Drop any historical message from past days/hours or from before the server/agent started.
    if (this.settings.onlyReplyToNewMessages !== false) {
      const msgTimestamp = params.messageTimestamp || Date.now();
      const maxAgeMs = (this.settings.maxMessageAgeSeconds || 45) * 1000;
      const messageAgeMs = Date.now() - msgTimestamp;

      // If message is older than 45s (historical sync) or was sent before this server boot
      if (messageAgeMs > maxAgeMs || msgTimestamp < this.serviceBootTimestamp - 3000) {
        return;
      }
    }

    // ANTI-BAN BURST DETECTION & CIRCUIT BREAKER
    const now = Date.now();
    if (this.circuitBreakerTripped) {
      if (now < this.circuitBreakerCooldownUntil) {
        console.warn(`[AI Agent Anti-Ban] Circuit breaker active. Dropping incoming message from ${cleanPhone}`);
        return;
      } else {
        this.circuitBreakerTripped = false;
        this.circuitBreakerCooldownUntil = 0;
      }
    }

    // Check message burst frequency (more than 25 incoming messages within 15s across the system indicates abuse)
    this.recentIncomingTimestamps.push(now);
    this.recentIncomingTimestamps = this.recentIncomingTimestamps.filter(
      (t) => now - t <= 15_000
    );
    if (this.recentIncomingTimestamps.length > 25) {
      this.circuitBreakerTripped = true;
      this.circuitBreakerCooldownUntil = now + 30 * 1000; // 30 seconds cooldown only (not 3 minutes)

      this.addLog({
        phone: cleanPhone,
        type: "safety_paused",
        title: "🚨 تفعيل قاطع الأمان التلقائي لحماية الحساب من الحظر",
        details: `تم رصد تدفق غير طبيعي (${this.recentIncomingTimestamps.length} رسائل خلال 15 ثانية). تم تفعيل حماية مؤقتة لمدة 30 ثانية لتفادي قيود واتساب.`,
      });
      return;
    }

    // 2. Check Blacklist
    if (
      this.settings.blacklistPhones.some((p) =>
        normalizePhoneNumber(p) === cleanPhone
      )
    ) {
      return;
    }

    // 3. Check Whitelist Mode
    if (
      this.settings.operatingMode === "whitelist_only" &&
      !this.settings.whitelistPhones.some(
        (p) => normalizePhoneNumber(p) === cleanPhone
      )
    ) {
      return;
    }

    // 4. Check if global master switch is off
    if (!this.settings.enabled || this.settings.operatingMode === "off") {
      return;
    }

    // 5. Check or Create Session
    let session = this.sessions.get(cleanPhone);
    const nowIso = new Date().toISOString();

    if (!session) {
      session = {
        phone: cleanPhone,
        name: params.senderName || `عميل (${cleanPhone.slice(-4)})`,
        status: "active",
        leadScore: 25,
        leadQuality: "cold",
        intent: "general",
        summary: "",
        keyPreferences: [],
        totalTurns: 0,
        firstInteraction: nowIso,
        lastInteraction: nowIso,
        accountId: params.accountId,
        accountName: params.accountName,
      };
      this.sessions.set(cleanPhone, session);
      this.saveSessions();
    } else {
      session.lastInteraction = nowIso;
      if (params.senderName && (!session.name || session.name.startsWith("عميل ("))) {
        session.name = params.senderName;
      }
      if (params.accountId) session.accountId = params.accountId;
      if (params.accountName) session.accountName = params.accountName;
    }

    // 6. Check New Leads Only mode
    if (
      this.settings.operatingMode === "new_leads_only" &&
      session.totalTurns > 6
    ) {
      return;
    }

    // 7. Check if session is currently in Human Takeover
    if (session.status === "human_takeover") {
      session.hasUnreadForHuman = true;
      this.saveSessions();
      this.addLog({
        phone: cleanPhone,
        type: "incoming_message",
        title: `رسالة واردة أثناء التدخل اليدوي من ${session.name}`,
        details: `[${params.text}] - لم يتم الرد تلقائياً لأن المحادثة قيد التدخل البشري.`,
      });
      return;
    }

    // 8. Buffer / Debounce rapid multi-part messages
    const existingDebounce = this.pendingDebounceMap.get(cleanPhone);
    if (existingDebounce) {
      clearTimeout(existingDebounce.timer);
      existingDebounce.messages.push(params.text);
      existingDebounce.timer = setTimeout(() => {
        this.processBufferedTurn(cleanPhone);
      }, 2400);
    } else {
      this.pendingDebounceMap.set(cleanPhone, {
        messages: [params.text],
        senderName: params.senderName,
        accountId: params.accountId,
        accountName: params.accountName,
        timer: setTimeout(() => {
          this.processBufferedTurn(cleanPhone);
        }, 2400),
      });
    }
  }

  // Helper: Match interactive numbered options & customer menu choices
  public matchInteractiveOption(text: string): {
    reply: string;
    intent: AILeadIntent;
    leadScore: number;
    isHumanHandoff?: boolean;
    handoffReason?: string;
  } | null {
    const normalized = text.trim().toLowerCase();

    // OPTION 4: Human Support Handoff ("4", "٤", "اربعة", "خدمة العملاء", "موظف")
    if (/^([4٤]|اربعة|أربعة|خدمة العملاء|موظف|بشري)(\s*[\.\,\!\؟\-]*)$/i.test(normalized)) {
      return {
        reply:
          this.settings.handoffMessage ||
          "تم تحويل محادثتك لأحد ممثلي خدمة العملاء وسيتواصل معك في أقرب وقت. شكراً لصبرك! 🌸",
        intent: "human_request",
        leadScore: 75,
        isHumanHandoff: true,
        handoffReason: "اختار العميل رقم 4 للتحدث مع ممثل خدمة العملاء",
      };
    }

    // RETAIL OPTION: Customer asking for Retail Prices ("سعر القطاعي", "القطاعي", "اسعار القطاعي", "التجزئة", etc.)
    if (this.isRetailInquiry(normalized)) {
      return {
        reply: this.formatRetailCatalogReply(),
        intent: "pricing",
        leadScore: 65,
      };
    }

    // OPTION 1: Product Catalog & Prices ("1", "١", "واحد", "المنتجات", "الاسعار", "الأسعار", "كتالوج", "قائمة")
    if (
      /^([1١]|واحد|المنتجات|الاسعار|الأسعار|قائمة|كتالوج|الكتالوج|الاصناف|عرض المنتجات)(\s*[\.\,\!\؟\-]*)$/i.test(
        normalized
      )
    ) {
      const inStock = this.knowledge.products.filter((p) => p.inStock);
      const listToDisplay = inStock.length > 0 ? inStock : this.knowledge.products;

      if (listToDisplay.length === 0) {
        return {
          reply: `📦 *كتالوج منتجات ${this.knowledge.companyName}:*\n\nلا توجد منتجات مسجلة في الكتالوج حالياً. يمكنك الاستفسار مباشرة أو التحدث مع فريق المبيعات (اكتب 4).`,
          intent: "pricing",
          leadScore: 40,
        };
      }

      let catalogText = `📦 *قائمة المنتجات والأسعار المتاحة لدى ${this.knowledge.companyName}:*\n`;
      catalogText += `⚠️ *تنويه هام:* جميع الأسعار الموضحة أدناه هي **أسعار جملة وتوريدات تجارية** مخصصة للمطاعم والشركات والكميات.\n\n`;
      listToDisplay.forEach((p, idx) => {
        catalogText += `${idx + 1}️⃣ *${p.name.trim()}*\n`;
        const priceStr = p.price > 0 ? `${p.price} ${p.currency || this.knowledge.currency}` : "السعر عند الطلب (Price on request)";
        catalogText += `   💰 السعر (جملة): *${priceStr}*\n`;
        if (p.description) {
          catalogText += `   ✨ ${p.description.trim()}\n`;
        }
        if (p.features && p.features.length > 0) {
          catalogText += `   🏷️ ${p.features.slice(0, 2).join(" • ")}\n`;
        }
        catalogText += "\n";
      });

      catalogText += `🛒 *للطلب والشراء:* أرسل اسم المنتج أو رقمه (مثال: "طلب 1" أو "طلب ${listToDisplay[0]?.name?.trim() || "المنتج"}")\n\n`;
      catalogText += `💡 يمكنك أيضاً الرد بـ:\n2️⃣ تفاصيل الشحن وطرق الدفع | 4️⃣ التحدث مع خدمة العملاء`;

      return {
        reply: catalogText,
        intent: "pricing",
        leadScore: 55,
      };
    }

    // OPTION 2: Shipping, Payment & Policies ("2", "٢", "اتنين", "اثنين", "الشحن", "شحن", "التوصيل", "طرق الدفع", "الدفع", "الضمان")
    if (
      /^([2٢]|اتنين|اثنين|الشحن|شحن|التوصيل|توصيل|طرق الدفع|الدفع|الضمان|استرجاع|الاسترجاع|مصاريف الشحن)(\s*[\.\,\!\؟\-]*)$/i.test(
        normalized
      )
    ) {
      let shippingInfo = `🚚 *تفاصيل الشحن، طرق الدفع والضمان لدى ${this.knowledge.companyName}:*\n\n`;
      shippingInfo += `📦 *الشحن والتوصيل:*\n${this.knowledge.shippingPolicy || "توصيل سريع لجميع المحافظات مع إمكانية معاينة الشحنة قبل الاستلام."}\n\n`;
      shippingInfo += `💳 *طرق الدفع المتاحة:*\n${this.knowledge.paymentMethods || "الدفع عند الاستلام كاش، إنستاباي، محفظة إلكترونية، أو تحويل بنكي."}\n\n`;
      shippingInfo += `🛡️ *الضمان والاسترجاع:*\n${this.knowledge.returnPolicy || "ضمان استبدال واسترجاع خلال 14 يوماً ضد عيوب الصناعة."}\n\n`;
      shippingInfo += `💡 *للطلب والتأكيد:* اكتب 3 أو اسم المنتج المطلوب، أو اكتب 4 للتحدث مع موظف خدمة العملاء.`;

      return {
        reply: shippingInfo,
        intent: "inquiry",
        leadScore: 50,
      };
    }

    // OPTION 3: Order Submission & Guided Details ("3", "٣", "تلاتة", "ثلاثة", "طلب", "أوردر", "اوردر", "شراء", "حجز", "تأكيد اوردر")
    if (
      /^([3٣]|تلاتة|ثلاثة|طلب|أوردر|اوردر|شراء|حجز|طلب جديد|عايز اطلب|عمل طلب|تأكيد اوردر|تاكيد اوردر|تأكيد الأوردر|تاكيد الاوردر|تأكيد الطلب|تاكيد الطلب)(\s*[\.\,\!\؟\-]*)$/i.test(
        normalized
      )
    ) {
      let orderGuide = `يسعدنا جداً استلام طلبك وتجهيزه فوراً! 🛒🌸\n\n`;
      orderGuide += `يرجى تزويدنا بالبيانات التالية لتسجيل وتجهيز الأوردر:\n`;
      orderGuide += `1️⃣ *اسم المنتج والكمية المطلوبة*\n`;
      orderGuide += `2️⃣ *الاسم بالكامل*\n`;
      orderGuide += `3️⃣ *العنوان بالتفصيل (المحافظة - المدينة - المنطقة - اسم الشارع)*\n`;
      orderGuide += `4️⃣ *رقم هاتف للتأكيد*\n\n`;
      orderGuide += `📍 *ملاحظة:* بعد إرسال بياناتك، سنطلب منك إرسال اللوكيشن الخاص بك (Location 📍) لتسهيل عملية الاستلام وسرعة وصول مندوب التوصيل لمكانك بدقة! 🚚`;

      return {
        reply: orderGuide,
        intent: "purchasing",
        leadScore: 85,
      };
    }

    return null;
  }

  // --- Arabic NLP & Fuzzy FAQ/Knowledge Matcher ---

  public normalizeArabic(text: string): string {
    if (!text) return "";
    return text
      .toLowerCase()
      // Remove diacritics / tashkeel
      .replace(/[\u064B-\u065F\u0670]/g, "")
      // Remove tatweel
      .replace(/\u0640/g, "")
      // Normalize alef variants (إ, أ, آ -> ا)
      .replace(/[إأآا]/g, "ا")
      // Normalize taa marbouta (ة -> ه)
      .replace(/ة/g, "ه")
      // Normalize alef maksoura (ى -> ي)
      .replace(/ى/g, "ي")
      // Normalize hamza variants (ؤ, ئ -> ء)
      .replace(/[ؤئ]/g, "ء")
      // Remove non-alphanumeric except Arabic, Latin, numbers and spaces
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  public stripArabicPrefix(word: string): string {
    if (!word || word.length <= 3) return word;
    let w = word;
    if (w.startsWith("وال")) w = w.slice(3);
    else if (
      w.startsWith("فال") ||
      w.startsWith("بال") ||
      w.startsWith("كال") ||
      w.startsWith("لل")
    ) {
      w = w.slice(2);
    } else if (w.startsWith("ال")) {
      w = w.slice(2);
    } else if (w.startsWith("و") && w.length >= 4) {
      w = w.slice(1);
    }
    return w;
  }

  public findClosestFaqMatch(
    userQuery: string,
    options?: { minScore?: number }
  ): {
    faq: AIFaqItem;
    score: number;
    answer: string;
    formattedReply: string;
    intent: AILeadIntent;
  } | null {
    if (!userQuery || !this.knowledge.faqs || this.knowledge.faqs.length === 0) {
      return null;
    }

    const normUser = this.normalizeArabic(userQuery);
    if (!normUser || normUser.length < 2) return null;

    const stopWords = new Set([
      "لو",
      "سمحت",
      "من",
      "فضلك",
      "يا",
      "فندم",
      "باشا",
      "حضرتك",
      "هو",
      "هي",
      "عن",
      "مع",
      "في",
      "على",
      "إلى",
      "الى",
    ]);
    const userWords = normUser
      .split(" ")
      .filter((w) => w.length > 1 && !stopWords.has(w));
    const userStems = userWords.map((w) => this.stripArabicPrefix(w));

    let bestFaq: AIFaqItem | null = null;
    let highestScore = 0;

    for (const faq of this.knowledge.faqs) {
      if (!faq.question || !faq.answer) continue;

      let score = 0;
      const normQ = this.normalizeArabic(faq.question);
      const normA = this.normalizeArabic(faq.answer);

      // 1. Exact match (Score 2.5)
      if (normUser === normQ) {
        score += 2.5;
      }
      // 2. Direct containment (Score 1.8)
      else if (normUser.includes(normQ) || normQ.includes(normUser)) {
        score += 1.8;
      }

      // 3. Question Word & Stem matching
      const qWords = normQ
        .split(" ")
        .filter((w) => w.length > 1 && !stopWords.has(w));
      const qStems = qWords.map((w) => this.stripArabicPrefix(w));
      const aWords = normA
        .split(" ")
        .filter((w) => w.length > 2 && !stopWords.has(w));
      const aStems = aWords.map((w) => this.stripArabicPrefix(w));

      let matchedStemsInQ = 0;
      let matchedStemsInA = 0;
      for (const us of userStems) {
        if (
          qStems.some(
            (qs) =>
              qs === us ||
              (qs.length >= 3 &&
                us.length >= 3 &&
                (qs.includes(us) || us.includes(qs)))
          )
        ) {
          matchedStemsInQ += 1;
        } else if (
          aStems.some(
            (as) =>
              as === us ||
              (as.length >= 3 &&
                us.length >= 3 &&
                (as.includes(us) || us.includes(as)))
          )
        ) {
          matchedStemsInA += 0.5;
        }
      }

      if (userStems.length > 0) {
        score += (matchedStemsInQ / userStems.length) * 0.9;
        score += (matchedStemsInA / userStems.length) * 0.3;
      }

      // 4. Semantic cluster matching with common Arabic food service expressions
      const clusters = [
        {
          // Natural product / ISO / Quality inquiry ("هل هي منتج طبيعي", "طبيعي ولا نباتي", "اورجانيك")
          keywords: [
            "طبيعي",
            "طبيعيه",
            "طبيعيا",
            "طبيعة",
            "اورجانيك",
            "نباتي",
            "دهن نباتي",
            "زيوت مهدرجه",
            "مغشوشه",
            "مغشوش",
            "ايزو",
            "مواصفات",
            "جوده",
            "مكونات",
            "نسبه طبيعي",
          ],
          faqMatch: () =>
            normQ.includes("طبيعي") ||
            normA.includes("طبيعي") ||
            normA.includes("ايزو"),
        },
        {
          // Where to buy / Branch / Delivery location ("اجبها منين", "بتتباع فين", "مكانكم", "عنوانكم", "المحل")
          keywords: [
            "اجبها",
            "اجيبها",
            "بتتباع",
            "تتباع",
            "فين",
            "منين",
            "مكانكم",
            "عنوانكم",
            "المقر",
            "المحل",
            "المعرض",
            "فروع",
            "فرع",
            "منافذ",
            "منفذ",
            "شراء منين",
            "اجيب منين",
            "اشتري منين",
            "مندوب",
            "مكان الشركه",
            "شراء شخصي",
          ],
          faqMatch: () =>
            normQ.includes("اجبها") ||
            normQ.includes("بتتباع") ||
            normQ.includes("مكان") ||
            normA.includes("مندوب توصيل"),
        },
        {
          // Sample inquiries ("في عينات؟", "ممكن عينة", "تست", "اجرب الموزاريلا")
          keywords: [
            "عينات",
            "عينه",
            "عين",
            "تست",
            "تيست",
            "اجرب",
            "اجربها",
            "تجربه",
            "تذوق",
            "عينات تجريبيه",
            "عايز اجرب",
            "طلب عينه",
          ],
          faqMatch: () =>
            normQ.includes("عينات") ||
            normA.includes("عينات") ||
            normQ.includes("تجريب"),
        },
        {
          // Retail vs Food Service / Bulk ("قطاعي ولا جملة", "للأفراد", "كيس واحد", "بالكيلو")
          keywords: [
            "قطاعي",
            "افراد",
            "شخصي",
            "كيس",
            "علبه",
            "واحده",
            "بالكيلو",
            "كيلو واحد",
            "للبيت",
            "منزلي",
            "جمله",
            "مطاعم",
            "فود سيرفس",
            "شركات",
            "كرتونه",
            "شيكاره",
          ],
          faqMatch: () =>
            normQ.includes("قطاعي") ||
            normQ.includes("افراد") ||
            normA.includes("فود سيرفس"),
        },
        {
          // Shipping & Delivery zones ("بتوصلوا فين", "مواعيد الشحن", "القاهرة والجيزة", "المحافظات")
          keywords: [
            "شحن",
            "توصيل",
            "بتوصلوا",
            "يوصل",
            "شاحن",
            "القاهره",
            "الجيزه",
            "محافظات",
            "اسكندريه",
            "صعيد",
            "مواعيد",
            "كام يوم",
            "وقت التوصيل",
            "سريع",
            "24 ساعه",
            "48 ساعه",
          ],
          faqMatch: () =>
            normQ.includes("شحن") ||
            normQ.includes("توصيل") ||
            normA.includes("القاهره والجيزه") ||
            normQ.includes("مناطق"),
        },
        {
          // Payment methods ("طريقة الدفع", "انستاباي", "كاش", "تحويل بنكي", "فواتير")
          keywords: [
            "دفع",
            "سداد",
            "كاش",
            "انستاباي",
            "instapay",
            "تحويل",
            "بنكي",
            "فيزا",
            "فواتير",
            "فاتوره",
            "ضريبيه",
          ],
          faqMatch: () =>
            normQ.includes("دفع") ||
            normQ.includes("سداد") ||
            normA.includes("انستاباي") ||
            normA.includes("تحويل بنكي"),
        },
        {
          // Order placement & Contract ("طريقة الطلب", "ازاي اطلب", "تعاقد توريد")
          keywords: [
            "اطلب",
            "طلب",
            "اوردر",
            "حجز",
            "شراء",
            "تعاقد",
            "توريد دوري",
            "ازاي اطلب",
            "طريقه الطلب",
            "رقم المبيعات",
          ],
          faqMatch: () =>
            normQ.includes("طلب شراء") ||
            normQ.includes("تعاقد") ||
            normA.includes("ارسال المنتجات"),
        },
        {
          // Factory & HQ location ("العنوان فين؟", "المقر", "المصنع", "مدينة بدر", "المعادي")
          keywords: [
            "العنوان فين",
            "عنوانكم فين",
            "المصنع فين",
            "مكان المصنع",
            "المقر الاداري",
            "مقر الشركه",
            "مدينه بدر",
            "المعادي",
            "اين يقع",
            "فين المصنع",
          ],
          faqMatch: () =>
            normQ.includes("المصنع") ||
            normQ.includes("المقر") ||
            normA.includes("مدينه بدر") ||
            normA.includes("المعادي"),
        },
        {
          // Supermarket presence ("موجودة في السوبر ماركت؟", "الماركت", "هايبر")
          keywords: [
            "سوبر ماركت",
            "سوبرماركت",
            "ماركت",
            "هايبر",
            "محل بقاله",
            "موجوده في الماركت",
            "بتنزل ماركت",
            "في المحلات",
          ],
          faqMatch: () =>
            normQ.includes("سوبر ماركت") ||
            normA.includes("سوبر ماركت") ||
            normA.includes("300 جنيه"),
        },
        {
          // Wholesale pricing specifics ("ما هو سعر الجملة؟", "اسعار الجمله")
          keywords: [
            "سعر الجمله",
            "اسعار الجمله",
            "فرق السعر",
            "سعر الكرتونه كام",
            "جمله ولا قطاعي",
          ],
          faqMatch: () =>
            normQ.includes("سعر الجمله") ||
            normA.includes("اسعار الجمله المعتمدة"),
        },
        {
          // Branches in governorates ("هل يوجد فرع في المحافظات؟", "شحن محافظات للجبن")
          keywords: [
            "فرع في المحافظات",
            "فروع في المحافظات",
            "فرع اسكندريه",
            "فرع طنطا",
            "فرع المنصوره",
            "فرع الصعيد",
            "فروعكم بالمحافظات",
          ],
          faqMatch: () =>
            normQ.includes("فروع في المحافظات") ||
            normQ.includes("فرع او توصيل في المحافظات") ||
            normA.includes("سيارات وثلاجات تجميد"),
        },
        {
          // Shipping price outside Cairo ("كم سعر الشحن خارج القاهرة؟")
          keywords: [
            "سعر الشحن خارج القاهره",
            "تكلفه الشحن للمحافظات",
            "الشحن للمحافظات بكام",
            "مصاريف الشحن خارج القاهره",
          ],
          faqMatch: () =>
            normQ.includes("سعر الشحن خارج القاهره") ||
            normA.includes("تسعيره شركه الشحن"),
        },
        {
          // Shelf life & storage instructions ("مدة الصلاحية", "طريقة الحفظ", "التخزين", "سنة", "-18")
          keywords: [
            "مده الصلاحيه",
            "صلاحيه",
            "صلاحيتها",
            "تاريخ الانتهاء",
            "طريقه الحفظ",
            "تخزين",
            "ازاي احفظها",
            "درجه حراره",
            "تجميد",
            "فريزر",
            "18 مئويه",
            "سنه كامله",
          ],
          faqMatch: () =>
            normQ.includes("الصلاحيه") ||
            normQ.includes("الحفظ") ||
            normA.includes("تجميد (-18 مئويه)") ||
            normA.includes("سنه كامله"),
        },
        {
          // Carton contents & packaging weights ("الكرتونة فيها قد إيه؟", "كم كيلو", "الأوزان والعبوات")
          keywords: [
            "الكرتونه فيها قد ايه",
            "الكارتونه كام كيلو",
            "وزن الكرتونه",
            "كم كيلو في الكرتونه",
            "فيها كام كيس",
            "حجم الكرتونه",
            "الاوزان والعبوات",
            "10 كيلو",
          ],
          faqMatch: () =>
            normQ.includes("الكرتونه فيها") ||
            normQ.includes("الاوزان والعبوات") ||
            normA.includes("10 كيلو اجمالي"),
        },
      ];

      for (const cl of clusters) {
        if (cl.faqMatch()) {
          let hits = 0;
          for (const kw of cl.keywords) {
            const normKw = this.normalizeArabic(kw);
            if (normUser.includes(normKw)) {
              hits += 1;
            }
          }
          if (hits > 0) {
            score += Math.min(hits * 0.45, 1.2);
          }
        }
      }

      if (score > highestScore) {
        highestScore = score;
        bestFaq = faq;
      }
    }

    const minScore = options?.minScore ?? 0.4;
    if (!bestFaq || highestScore < minScore) return null;

    let intent: AILeadIntent = "inquiry";
    if (bestFaq.category?.includes("دفع")) intent = "pricing";
    if (bestFaq.category?.includes("طلب")) intent = "purchasing";

    const reply =
      `أهلاً بحضرتك في ${this.knowledge.companyName}! 🌸\n\n` +
      `📌 *بخصوص استفسارك:*\n` +
      `"${bestFaq.answer.trim()}"\n\n` +
      `💡 *هل تود الاستفسار عن أي تفاصيل أخرى أو حجز طلب؟ يسعدنا مساعدتك دائماً!*`;

    return {
      faq: bestFaq,
      score: highestScore,
      answer: bestFaq.answer,
      formattedReply: reply,
      intent,
    };
  }

  public findProductMatch(userQuery: string): {
    product: AIProduct;
    formattedReply: string;
    intent: AILeadIntent;
  } | null {
    if (!userQuery || !this.knowledge.products || this.knowledge.products.length === 0) {
      return null;
    }

    const normUser = this.normalizeArabic(userQuery);
    if (!normUser || normUser.length < 3) return null;

    // Do not match if query is generic greeting or pure option number
    if (/^[1-4١-٤]$/.test(normUser.trim())) return null;

    let bestProduct: AIProduct | null = null;
    let highestScore = 0;

    for (const prod of this.knowledge.products) {
      let score = 0;
      const normName = this.normalizeArabic(prod.name);

      // Direct name mention
      if (normUser.includes(normName)) {
        score += 2.0;
      }

      // Check key tokens
      const nameWords = normName
        .split(" ")
        .filter((w) => w.length > 2 && !["cheese", "جبنة", "جبنه"].includes(w));
      for (const nw of nameWords) {
        if (normUser.includes(nw)) {
          score += 0.7;
        }
      }

      // Check SKU
      if (prod.sku && normUser.includes(prod.sku.toLowerCase())) {
        score += 2.5;
      }

      // Specific popular keywords matching Solo Italiano items:
      if (normUser.includes("موزاريلا") || normUser.includes("موزريلا") || normUser.includes("mozzarella")) {
        if (prod.sku === "MOZZ-100" || prod.name.includes("100%")) score += 0.8;
      }
      if (normUser.includes("سان مارزانو") || normUser.includes("marzano")) {
        if (prod.name.includes("San Marzano")) score += 1.5;
      }
      if (normUser.includes("تايبو") || normUser.includes("tipo") || (normUser.includes("دقيق") && prod.name.includes("دقيق"))) {
        if (prod.name.includes("Tipo 00")) score += 1.5;
      }
      if (normUser.includes("بلسميك") || normUser.includes("balsamic")) {
        if (prod.name.includes("Balsamico") || prod.name.includes("بلسميك")) score += 1.2;
      }
      if (normUser.includes("سيراتشا") || normUser.includes("sriracha")) {
        if (prod.name.includes("Sriracha")) score += 1.5;
      }
      if (normUser.includes("كلاماتا") || normUser.includes("kalamata")) {
        if (prod.name.includes("Kalamata")) score += 1.5;
      }
      if (normUser.includes("هالبينو") || normUser.includes("jalapeno")) {
        if (prod.name.includes("Jalapeño")) score += 1.5;
      }

      if (score > highestScore) {
        highestScore = score;
        bestProduct = prod;
      }
    }

    if (!bestProduct || highestScore < 1.0) return null;

    const priceStr =
      bestProduct.price > 0
        ? `${bestProduct.price} ${bestProduct.currency || this.knowledge.currency}`
        : "السعر عند الطلب (Price on request)";

    // Customer asked about this product in retail (سعر القطاعي / بالكيلو قطاعي / تجزئة)
    if (this.isRetailInquiry(userQuery)) {
      if (this.isCheeseOrOliveOil(bestProduct.name)) {
        const retailPrice = this.getRetailUnitPrice(bestProduct.name, bestProduct.price);
        const retailPriceStr = `${retailPrice} ${bestProduct.currency || this.knowledge.currency}`;

        let reply = `📦 *تفاصيل المنتج (سعر القطاعي والتجزئة) لدى ${this.knowledge.companyName}:*\n\n`;
        reply += `🧀 *${bestProduct.name.trim()}*\n`;
        reply += `💰 السعر (قطاعي): *${retailPriceStr}* (بزيادة ${this.RETAIL_CHEESE_AND_OIL_MARKUP} ج.م فقط عن سعر الجملة ${bestProduct.price} ج.م)\n`;
        if (bestProduct.description) {
          reply += `✨ ${bestProduct.description.trim()}\n`;
        }
        if (bestProduct.features && bestProduct.features.length > 0) {
          reply += `🏷️ ${bestProduct.features.join(" • ")}\n`;
        }
        reply += `\n🚚 *مصاريف الشحن والتوصيل للقطاعي:*\n`;
        reply += `يتم إضافة **مصاريف شحن 50 ج.م** تلقائياً لأي طلب قطاعي (أقل من كرتونة) للتوصيل السريع والمبرد داخل القاهرة والجيزة.\n\n`;
        reply += `🛒 *للطلب والشراء:* أرسل الكمية المطلوبة وعنوانك وسنقوم بتسجيل وتأكيد الأوردر معك فوراً!`;

        return {
          product: bestProduct,
          formattedReply: reply,
          intent: "pricing",
        };
      } else {
        // Other products: "اما باقي المنتجات فتقول له نعتذر هذا المنتج اقل كميه منه كرتونه وطبعا بتزود عليه سعر الشخن مع اظهاره"
        let reply = `⚠️ *تنويه بخصوص ${bestProduct.name.trim()}:*\n\n`;
        reply += `نعتذر لحضرتك جداً، هذا المنتج **أقل كمية منه كرتونة كاملة** (جملة وتوريدات فقط)، ولا يتوفر منه بيع بالقطاعي أو بالعبوة الفردية.\n\n`;
        reply += `🧀 *المتوفر لدينا بالقطاعي والتجزئة:* منتجات الجبن الفاخرة (الموزاريلا، الرومي، ومكس الأجبان) وزيت الزيتون النقي بزيادة 20 ج.م فقط عن سعر الجملة، مع 50 ج.م مصاريف شحن للطلبات أقل من كرتونة.\n\n`;
        reply += `📦 *سعر الكرتونة بالجملة:* ${priceStr}\n`;
        reply += `🛒 إذا رغبت في حجز كرتونة كاملة يسعدنا خدمتك وتجهيز طلبك فوراً! 🌸`;

        return {
          product: bestProduct,
          formattedReply: reply,
          intent: "pricing",
        };
      }
    }

    let reply = `📦 *تفاصيل المنتج من كشف أسعار ${this.knowledge.companyName}:*\n`;
    reply += `⚠️ *تنويه:* السعر الموضح أدناه هو **سعر جملة وتوريدات تجارية**.\n\n`;
    reply += `🧀 *${bestProduct.name.trim()}*\n`;
    reply += `💰 السعر (جملة): *${priceStr}*\n`;
    if (bestProduct.description) {
      reply += `✨ ${bestProduct.description.trim()}\n`;
    }
    if (bestProduct.features && bestProduct.features.length > 0) {
      reply += `🏷️ ${bestProduct.features.join(" • ")}\n`;
    }
    reply += `\n🛒 *للطلب والشراء:* أرسل الكمية المطلوبة وعنوان المنشأة أو اكتب 3 لتأكيد الأوردر، وسيتواصل معك مندوبنا فوراً!`;

    return {
      product: bestProduct,
      formattedReply: reply,
      intent: "pricing",
    };
  }

  public findPolicyMatch(userQuery: string): {
    policyName: string;
    answer: string;
    formattedReply: string;
  } | null {
    const normUser = this.normalizeArabic(userQuery);
    if (!normUser) return null;

    // Shipping policy
    if (
      normUser.includes("شحن") ||
      normUser.includes("توصيل") ||
      normUser.includes("بتوصلوا") ||
      normUser.includes("مصاريف الشحن")
    ) {
      const text = this.knowledge.shippingPolicy || "توريد سريع خلال 24 إلى 48 ساعة داخل القاهرة والجيزة.";
      return {
        policyName: "الشحن والتوصيل",
        answer: text,
        formattedReply: `🚚 *تفاصيل الشحن والتوريد لدى ${this.knowledge.companyName}:*\n\n${text}\n\n💡 يمكنك الرد بـ 1 لاستعراض الكتالوج، أو 3 لطلب أوردر جديد.`,
      };
    }

    // Payment methods
    if (
      normUser.includes("طريقه الدفع") ||
      normUser.includes("طرق الدفع") ||
      normUser.includes("دفع") ||
      normUser.includes("سداد") ||
      normUser.includes("انستاباي")
    ) {
      const text = this.knowledge.paymentMethods || "تحويل بنكي • إنستاباي (InstaPay) • كاش عند الاستلام • فواتير ضريبية.";
      return {
        policyName: "طرق الدفع",
        answer: text,
        formattedReply: `💳 *طرق الدفع المتاحة لدى ${this.knowledge.companyName}:*\n\n${text}\n\n💡 هل تود تأكيد أوردر؟ يسعدنا خدمتك دائماً!`,
      };
    }

    // Return policy
    if (
      normUser.includes("استرجاع") ||
      normUser.includes("استبدال") ||
      normUser.includes("ضمان") ||
      normUser.includes("تالف")
    ) {
      const text = this.knowledge.returnPolicy || "فحص ومعاينة الشحنة قبل الاستلام مع استبدال فوري ضد عيوب الصناعة.";
      return {
        policyName: "الضمان والاسترجاع",
        answer: text,
        formattedReply: `🛡️ *سياسة الضمان والاسترجاع لدى ${this.knowledge.companyName}:*\n\n${text}`,
      };
    }

    return null;
  }

  private async processBufferedTurn(phone: string) {
    const entry = this.pendingDebounceMap.get(phone);
    this.pendingDebounceMap.delete(phone);
    if (!entry || entry.messages.length === 0) return;

    const session = this.sessions.get(phone);
    if (!session || session.status !== "active") return;

    const combinedMessage = entry.messages.join("\n").trim();
    const accountId = entry.accountId || session.accountId || "default";

    // 1. Check for immediate explicit human handoff keywords
    const lower = combinedMessage.toLowerCase();
    const matchesKeyword = this.settings.humanHandoffKeywords.some((kw) =>
      lower.includes(kw.toLowerCase())
    );

    if (matchesKeyword) {
      await this.triggerHumanHandoff(
        phone,
        "طلب العميل التحدث مع موظف خدمة عملاء أو ممثل بشري",
        accountId
      );
      return;
    }

    // 2. SMART INTERACTIVE OPTIONS SYSTEM & DETERMINISTIC GUIDED FLOW
    // Solves: "وعاوزه يكون حاطط اختيارات للعميل بدل ميفضل يسال ويبقي الكلام مش مطابق وميردش علي العميل"
    if (this.settings.enableInteractiveOptions !== false) {
      const menuMatch = this.matchInteractiveOption(combinedMessage);
      if (menuMatch) {
        if (menuMatch.isHumanHandoff) {
          await this.triggerHumanHandoff(
            phone,
            menuMatch.handoffReason || "اختار العميل التحدث مع ممثل خدمة العملاء",
            accountId
          );
          return;
        }

        const aiResult = {
          replyMessage: menuMatch.reply,
          intent: menuMatch.intent,
          leadScore: Math.max(session.leadScore, menuMatch.leadScore),
          leadQuality: (menuMatch.leadScore >= 70 ? "hot" : "warm") as AILeadQuality,
          wantsHumanAgent: false,
          sentiment: "positive" as const,
          memorySummary: `تفاعل العميل مع القائمة التفاعلية واختار ${menuMatch.intent}`,
        };

        this.enqueueSafeReply({
          accountId,
          phone,
          customerName: session.name,
          replyText: menuMatch.reply,
          session,
          aiResult,
        });

        session.totalTurns += 1;
        session.lastInteraction = new Date().toISOString();
        session.intent = menuMatch.intent;
        session.leadScore = aiResult.leadScore;
        session.leadQuality = aiResult.leadQuality;
        this.saveSessions();
        if (this.settings.autoScoreLeads) this.syncLeadWithCRM(phone, session, aiResult);
        return;
      }

      // GREETINGS: Warm Welcome ONLY if it is truly a greeting!
      // CRITICAL: Never treat a real inquiry as a greeting just because totalTurns === 0
      const normalized = combinedMessage.trim().toLowerCase();
      const isGreeting =
        /^(السلام عليكم|سلام عليكم|مرحبا|مرحباً|أهلاً|اهلا|صباح الخير|مساء الخير|هاي|هلو|hello|hi|hey)(\s*[\.\,\!\؟\-]*)$/i.test(
          normalized
        );

      if (isGreeting) {
        let welcomeTemplate =
          this.settings.welcomeMessage?.replace("{company}", this.knowledge.companyName) ||
          `أهلاً بحضرتك في ${this.knowledge.companyName}! 🌸\n⚠️ *تنويه هام:* نود التوضيح في البداية أن جميع أسعارنا الموضحة هي **أسعار جملة وتوريدات تجارية** مخصصة للمطاعم والفنادق والشركات والكميات.`;

        if (!welcomeTemplate.includes("جملة") && !welcomeTemplate.includes("جمله")) {
          welcomeTemplate += "\n⚠️ *تنويه هام:* نود التوضيح في البداية أن جميع أسعارنا الموضحة هي **أسعار جملة وتوريدات تجارية** مخصصة للمطاعم والشركات والكميات.";
        }

        const welcomeText = `${welcomeTemplate}\n\nيسعدنا تواصلك معنا، تفضل باختيار رقم الخدمة المطلوبة أو اكتب استفسارك مباشرة:\n\n${this.getInteractiveMenuText()}\n\n(أو اكتب سؤالك وسأجيبك فوراً!)`;

        const aiResult = {
          replyMessage: welcomeText,
          intent: "general" as AILeadIntent,
          leadScore: Math.max(session.leadScore, 30),
          leadQuality: "cold" as AILeadQuality,
          wantsHumanAgent: false,
          sentiment: "positive" as const,
          memorySummary: "ترحيب بالعميل وعرض قائمة الخيارات التفاعلية",
        };

        this.enqueueSafeReply({
          accountId,
          phone,
          customerName: session.name,
          replyText: welcomeText,
          session,
          aiResult,
        });

        session.totalTurns += 1;
        session.lastInteraction = new Date().toISOString();
        this.saveSessions();
        return;
      }
    }

    // 2.5 DETERMINISTIC ORDER SUBMISSION & LOCATION WORKFLOW
    // Solves: "المفروض لما العميل يختار تأكيد اوردر ويدخل بياناته تطلب منه يبعت اللوكيشن الخاص به لتسهيل عمليه الاستلام وبعدها يكتبله رساله شكر وانه تم تأكيد الاوردر"
    const orderFlowResult = this.handleOrderAndLocationFlow({
      message: combinedMessage,
      phone,
      session,
      accountId,
    });

    if (orderFlowResult && orderFlowResult.handled) {
      const isObjection = this.isOrderObjection(combinedMessage);
      const aiResult = {
        replyMessage: orderFlowResult.replyText,
        intent: orderFlowResult.intent,
        leadScore: Math.max(session.leadScore, orderFlowResult.leadScore),
        leadQuality: orderFlowResult.leadQuality,
        wantsHumanAgent: orderFlowResult.wantsHumanAgent ?? false,
        sentiment:
          orderFlowResult.sentiment ??
          (isObjection ? ("neutral" as const) : ("positive" as const)),
        memorySummary:
          orderFlowResult.memorySummary ||
          (orderFlowResult.isLocationConfirmed
            ? `تم استلام اللوكيشن وتأكيد الأوردر #${orderFlowResult.order?.id} بنجاح`
            : `تم تسجيل بيانات الأوردر #${orderFlowResult.order?.id} وبانتظار اللوكيشن لتسهيل الاستلام`),
      };

      this.enqueueSafeReply({
        accountId,
        phone,
        customerName: session.name,
        replyText: orderFlowResult.replyText,
        session,
        aiResult,
      });

      session.totalTurns += 1;
      session.lastInteraction = new Date().toISOString();
      session.intent = orderFlowResult.intent;
      session.leadScore = aiResult.leadScore;
      session.leadQuality = aiResult.leadQuality;
      this.saveSessions();
      if (this.settings.autoScoreLeads) this.syncLeadWithCRM(phone, session, aiResult);
      return;
    }

    // 3. BULLETPROOF FAQ & KNOWLEDGE MATCHER (Direct, Grounded & Instant)
    // Solves: "ليه الاسئله الشائعه لما حد بيسال حاجه زيها او مشابه ليها مش بيرد خالص احنا عاوزينه يرد ويشوف اقرب اجابه مناسبه"
    const faqMatch = this.findClosestFaqMatch(combinedMessage, { minScore: 0.35 });
    if (faqMatch) {
      this.addLog({
        phone,
        type: "ai_reply",
        title: `إجابة فورية من الأسئلة الشائعة (FAQ) إلى ${session.name}`,
        details: `السؤال المتطابق: "${faqMatch.faq.question}" (تطابق: ${(faqMatch.score * 100).toFixed(0)}%)\nالرد: "${faqMatch.formattedReply}"`,
      });

      const aiResult = {
        replyMessage: faqMatch.formattedReply,
        intent: faqMatch.intent,
        leadScore: Math.max(session.leadScore, 65),
        leadQuality: "warm" as AILeadQuality,
        wantsHumanAgent: false,
        sentiment: "positive" as const,
        memorySummary: `أجاب الوكيل على استفسار العميل من الأسئلة الشائعة: ${faqMatch.faq.question}`,
      };

      this.enqueueSafeReply({
        accountId,
        phone,
        customerName: session.name,
        replyText: faqMatch.formattedReply,
        session,
        aiResult,
      });

      session.totalTurns += 1;
      session.lastInteraction = new Date().toISOString();
      session.intent = faqMatch.intent;
      session.leadScore = aiResult.leadScore;
      session.leadQuality = aiResult.leadQuality;
      this.saveSessions();
      if (this.settings.autoScoreLeads) this.syncLeadWithCRM(phone, session, aiResult);
      return;
    }

    // 4. Product Catalog Specific Inquiry Match
    const productMatch = this.findProductMatch(combinedMessage);
    if (productMatch) {
      this.addLog({
        phone,
        type: "ai_reply",
        title: `استعلام عن منتج من الكتالوج إلى ${session.name}`,
        details: `المنتج: "${productMatch.product.name}"\nالرد: "${productMatch.formattedReply}"`,
      });

      const aiResult = {
        replyMessage: productMatch.formattedReply,
        intent: productMatch.intent,
        leadScore: Math.max(session.leadScore, 70),
        leadQuality: "warm" as AILeadQuality,
        wantsHumanAgent: false,
        sentiment: "positive" as const,
        memorySummary: `استعلم العميل عن منتج ${productMatch.product.name}`,
      };

      this.enqueueSafeReply({
        accountId,
        phone,
        customerName: session.name,
        replyText: productMatch.formattedReply,
        session,
        aiResult,
      });

      session.totalTurns += 1;
      session.lastInteraction = new Date().toISOString();
      session.intent = productMatch.intent;
      session.leadScore = aiResult.leadScore;
      session.leadQuality = aiResult.leadQuality;
      this.saveSessions();
      if (this.settings.autoScoreLeads) this.syncLeadWithCRM(phone, session, aiResult);
      return;
    }

    // 5. Store Policies Match (Shipping, Return, Payment)
    const policyMatch = this.findPolicyMatch(combinedMessage);
    if (policyMatch) {
      this.addLog({
        phone,
        type: "ai_reply",
        title: `استعلام عن ${policyMatch.policyName} إلى ${session.name}`,
        details: policyMatch.formattedReply,
      });

      const aiResult = {
        replyMessage: policyMatch.formattedReply,
        intent: "inquiry" as AILeadIntent,
        leadScore: Math.max(session.leadScore, 50),
        leadQuality: "warm" as AILeadQuality,
        wantsHumanAgent: false,
        sentiment: "neutral" as const,
        memorySummary: `استفسر العميل عن ${policyMatch.policyName}`,
      };

      this.enqueueSafeReply({
        accountId,
        phone,
        customerName: session.name,
        replyText: policyMatch.formattedReply,
        session,
        aiResult,
      });

      session.totalTurns += 1;
      session.lastInteraction = new Date().toISOString();
      this.saveSessions();
      return;
    }

    // 6. Advanced Fallback to Gemini with Grounded Knowledge & Multi-Model Reliability
    try {
      this.addLog({
        phone,
        type: "incoming_message",
        title: `معالجة رسالة من ${session.name}`,
        details: `الرسالة: "${combinedMessage}"`,
      });

      const aiResult = await this.generateAgentResponse({
        phone,
        customerName: session.name,
        incomingText: combinedMessage,
        session,
      });

      // Handle AI-detected handoff request (due to inability to find a verified answer, customer service request, or strong negative sentiment)
      if (aiResult.wantsHumanAgent) {
        const handoffReason =
          aiResult.intent === "human_request"
            ? "عجز الوكيل الذكي عن إيجاد إجابة صحيحة ومؤكدة لسؤال العميل، أو طلب العميل التحدث مع موظف بشري"
            : "تم تحويل المحادثة لأحد ممثلي خدمة العملاء";
        await this.triggerHumanHandoff(
          phone,
          handoffReason,
          accountId,
          aiResult.replyMessage
        );
        return;
      }

      let replyText = aiResult.replyMessage;
      if (!replyText || replyText.trim().length === 0) {
        replyText = `أهلاً بك في ${this.knowledge.companyName}! 🌸\n` +
          `يسعدني مساعدتك، تفضل باختيار رقم الخدمة المطلوبة أو إرسال استفسارك:\n\n` +
          this.getInteractiveMenuText();
      }

      // 4. Enqueue message into Anti-Ban Safe Outgoing Queue (Rate-Limited, Serialized, Typing Sim)
      this.enqueueSafeReply({
        accountId,
        phone,
        customerName: session.name,
        replyText,
        session,
        aiResult,
      });

      // 4. Update Session memory & scoring
      session.totalTurns += 1;
      session.lastInteraction = new Date().toISOString();
      session.intent = aiResult.intent || session.intent;
      session.leadScore = Math.min(100, Math.max(0, aiResult.leadScore || session.leadScore));
      session.leadQuality =
        session.leadScore >= 70 ? "hot" : session.leadScore >= 40 ? "warm" : "cold";

      if (aiResult.memorySummary) {
        session.summary = aiResult.memorySummary;
      }
      if (aiResult.extractedPreferences && aiResult.extractedPreferences.length > 0) {
        const set = new Set([...session.keyPreferences, ...aiResult.extractedPreferences]);
        session.keyPreferences = Array.from(set).slice(-10);
      }
      this.saveSessions();

      // 7. Auto-Score / Update Lead in CRM
      if (this.settings.autoScoreLeads || this.settings.autoCreateCrmLeads) {
        this.syncLeadWithCRM(phone, session, aiResult);
      }

      // 8. Save extracted order if purchase intent confirmed
      if (
        aiResult.extractedOrder &&
        (aiResult.extractedOrder.hasOrderIntent ||
          (aiResult.extractedOrder.items && aiResult.extractedOrder.items.length > 0))
      ) {
        const locationInfo = this.extractLocationFromText(combinedMessage);
        const hasLocation = Boolean(
          aiResult.extractedOrder.hasLocation ||
            aiResult.extractedOrder.locationUrl ||
            locationInfo.hasLocation
        );
        const resolvedLocationUrl =
          aiResult.extractedOrder.locationUrl || locationInfo.locationUrl || "";

        const orderStatus =
          aiResult.extractedOrder.isOrderComplete && hasLocation ? "confirmed" : "draft";

        this.createOrUpdateOrder({
          phone,
          customerName: session.name,
          items: (aiResult.extractedOrder.items || []).map((it) => ({
            productName: it.productName,
            quantity: it.quantity || 1,
            unitPrice: it.unitPrice || 0,
            subtotal: (it.quantity || 1) * (it.unitPrice || 0),
          })),
          totalAmount: (aiResult.extractedOrder.items || []).reduce(
            (sum, it) => sum + (it.quantity || 1) * (it.unitPrice || 0),
            0
          ),
          shippingAddress: aiResult.extractedOrder.shippingAddress || "",
          locationUrl: resolvedLocationUrl,
          paymentMethod: aiResult.extractedOrder.paymentMethod || "الدفع عند الاستلام",
          notes: aiResult.extractedOrder.notes || "",
          status: orderStatus,
        });
      }
    } catch (err: any) {
      console.error(`[AI Sales Agent] Error handling turn for ${phone}:`, err);
      this.addLog({
        phone,
        type: "error",
        title: `خطأ أثناء معالجة المحادثة للرقم ${phone}`,
        details: err?.message || String(err),
      });
    }
  }

  // --- Anti-Ban Safe Outgoing Dispatcher & Serialized Queue ---

  private enqueueSafeReply(item: {
    accountId?: string;
    phone: string;
    customerName: string;
    replyText: string;
    session: AIAgentSession;
    aiResult: any;
  }) {
    if (this.circuitBreakerTripped && Date.now() < this.circuitBreakerCooldownUntil) {
      this.addLog({
        phone: item.phone,
        type: "anti_ban_blocked",
        title: `حظر رد آلي مؤقت إلى ${item.customerName} لحماية الحساب`,
        details: "قاطع أمان الحظر نشط حالياً. تم إلغاء الرد التلقائي تفادياً لحظر رقم الواتساب.",
      });
      return;
    }

    // Safety buffer limit: keep up to 35 pending replies so valid customer responses are never lost
    if (this.outgoingSafeQueue.length >= 35) {
      const dropped = this.outgoingSafeQueue.shift();
      if (dropped) {
        this.addLog({
          phone: dropped.phone,
          type: "anti_ban_blocked",
          title: `تفريغ رد قديم من طابور الإرسال (${dropped.customerName})`,
          details: "تم تفريغ رد قديم تفادياً لتراكم الرسائل وحماية حساب واتساب.",
        });
      }
    }

    this.outgoingSafeQueue.push(item);
    this.processOutgoingQueue().catch((err) => {
      console.error("[AI Sales Agent Safe Queue] Error in processOutgoingQueue:", err);
    });
  }

  private async processOutgoingQueue() {
    if (this.isProcessingQueue) return;
    this.isProcessingQueue = true;

    try {
      while (this.outgoingSafeQueue.length > 0) {
        if (this.circuitBreakerTripped && Date.now() < this.circuitBreakerCooldownUntil) {
          break;
        }

        const maxPerMin = Math.max(1, Math.min(6, this.settings.maxRepliesPerMinute || 3));
        const now = Date.now();
        this.recentSentTimestamps = this.recentSentTimestamps.filter((t) => now - t <= 60_000);

        // Enforce max messages per minute across the WhatsApp account
        if (this.recentSentTimestamps.length >= maxPerMin) {
          const oldest = this.recentSentTimestamps[0];
          const waitMs = Math.max(1000, 60_000 - (now - oldest) + 500);
          console.log(
            `[AI Agent Anti-Ban] Rate limit reached (${this.recentSentTimestamps.length}/${maxPerMin} per min). Waiting ${Math.round(waitMs / 1000)}s...`
          );
          await new Promise((r) => setTimeout(r, Math.min(waitMs, 15_000)));
          continue;
        }

        const item = this.outgoingSafeQueue.shift();
        if (!item) break;

        const { accountId, phone, customerName, replyText } = item;

        // Check per-phone cooldown (never send to same recipient within 3 seconds)
        const lastSentToPhone = this.phoneLastReplyMap.get(phone) || 0;
        const phoneGap = Date.now() - lastSentToPhone;
        if (phoneGap < 3000) {
          await new Promise((r) => setTimeout(r, 3000 - phoneGap));
        }

        // Show typing indicator in WhatsApp
        if (this.settings.typingIndicator && this.sendPresenceFn) {
          await this.sendPresenceFn(accountId, phone, "composing").catch(() => {});
        }

        // Natural responsive typing delay (1.5 to 3 seconds)
        const typingDelay =
          Math.max(1500, (this.settings.responseDelaySeconds || 2) * 1000) +
          Math.floor(Math.random() * 1000);
        await new Promise((r) => setTimeout(r, typingDelay));

        // Send via WhatsApp
        if (this.sendWhatsAppMessageFn) {
          const sendRes = await this.sendWhatsAppMessageFn(accountId, phone, replyText);

          if (sendRes.success) {
            this.recentSentTimestamps.push(Date.now());
            this.phoneLastReplyMap.set(phone, Date.now());

            crmService.recordOutgoingMessage(
              phone,
              replyText,
              accountId,
              this.settings.agentName
            );

            this.addLog({
              phone,
              type: "ai_reply",
              title: `تم إرسال رد الذكاء الاصطناعي إلى ${customerName}`,
              details: `الرد: "${replyText}"`,
            });
          } else {
            this.addLog({
              phone,
              type: "error",
              title: `تعذر إرسال رد واتساب إلى ${phone}`,
              details: sendRes.error || "خطأ غير محدد في الاتصال",
            });
          }
        }

        // Pause typing indicator
        if (this.settings.typingIndicator && this.sendPresenceFn) {
          await this.sendPresenceFn(accountId, phone, "paused").catch(() => {});
        }

        // Quick inter-message spacing (2 to 4 seconds)
        const minGapSec = Math.max(2, this.settings.minReplyIntervalSeconds || 4);
        const interMessageGap = minGapSec * 1000 + Math.floor(Math.random() * 1500);
        await new Promise((r) => setTimeout(r, interMessageGap));
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  private async triggerHumanHandoff(
    phone: string,
    reason: string,
    accountId?: string,
    customReplyText?: string
  ) {
    const session = this.sessions.get(phone);
    if (session) {
      session.status = "human_takeover";
      session.handoffReason = reason;
      session.handoffTimestamp = new Date().toISOString();
      session.hasUnreadForHuman = true;
      this.saveSessions();
    }

    this.addLog({
      phone,
      type: "human_handoff",
      title: "تحويل المحادثة إلى خدمة العملاء (Handoff Triggered)",
      details: `السبب: ${reason}`,
    });

    const handoffMsg =
      customReplyText ||
      this.settings.handoffMessage ||
      "تم تحويل محادثتك فوراً لأحد ممثلي خدمة العملاء للرد على استفسارك بدقة ومساعدتك، وسيتواصل معك أحد زملائنا خلال لحظات قليلة 🙏🌸";

    if (session) {
      this.enqueueSafeReply({
        accountId,
        phone,
        customerName: session.name,
        replyText: handoffMsg,
        session,
        aiResult: { intent: "human_request", leadScore: session.leadScore, wantsHumanAgent: true },
      });
    }

    crmService.addActivityByPhone(phone, {
      type: "whatsapp",
      title: "⚠️ تنبيه: تم تحويل المحادثة لخدمة العملاء",
      note: `السبب: ${reason}`,
      outcome: "human_handoff",
    });
  }

  private syncLeadWithCRM(
    phone: string,
    session: AIAgentSession,
    aiResult: {
      intent: AILeadIntent;
      leadScore: number;
      replyMessage: string;
      memorySummary?: string;
    }
  ) {
    try {
      const leads = crmService.getLeads();
      let lead = leads.find((l) => normalizePhoneNumber(l.phone) === phone);

      let stage: "new" | "interested" | "negotiation" | "won" = "interested";
      if (aiResult.intent === "purchasing") stage = "negotiation";
      else if (aiResult.intent === "inquiry" || aiResult.intent === "pricing") stage = "interested";
      else if (session.leadScore >= 80) stage = "negotiation";

      const priority: "high" | "medium" | "low" =
        session.leadScore >= 70 ? "high" : session.leadScore >= 40 ? "medium" : "low";

      if (!lead && this.settings.autoCreateCrmLeads) {
        lead = crmService.createLead({
          phone,
          name: session.name,
          stage,
          priority,
          source: "whatsapp_extracted",
          tags: ["AI Agent", session.leadQuality.toUpperCase(), aiResult.intent],
          notes: `ملخص ذكاء اصطناعي: ${session.summary || "تم بدء المحادثة مع الوكيل الذكي"}`,
        });
      } else if (lead) {
        lead.priority = priority;
        if (lead.stage === "new" || lead.stage === "follow_up") {
          lead.stage = stage;
        }
        if (!lead.tags.includes("AI Agent")) lead.tags.push("AI Agent");
        lead.updatedAt = new Date().toISOString();
        lead.aiAnalysis = {
          summary: session.summary || lead.aiAnalysis?.summary,
          sentiment:
            session.leadScore >= 60
              ? "positive"
              : session.leadScore <= 30
              ? "negative"
              : "neutral",
          recommendedAction:
            aiResult.intent === "purchasing"
              ? "تأكيد تفاصيل الشحن وإصدار الفاتورة"
              : "متابعة المنتجات المقترحة وتقديم خصم تشجيعي",
          analyzedAt: new Date().toISOString(),
        };
        crmService.updateLead(lead.id, lead);
      }
    } catch (e) {
      console.warn("CRM Lead sync notice:", e);
    }
  }

  // --- Core Gemini Integration with Grounded Knowledge & Anti-Hallucination ---

  private async generateAgentResponse(params: {
    phone: string;
    customerName: string;
    incomingText: string;
    session: AIAgentSession;
  }): Promise<{
    replyMessage: string;
    intent: AILeadIntent;
    leadScore: number;
    leadQuality: AILeadQuality;
    wantsHumanAgent: boolean;
    sentiment: "positive" | "neutral" | "negative";
    extractedPreferences?: string[];
    memorySummary?: string;
    extractedOrder?: {
      hasOrderIntent: boolean;
      isOrderComplete: boolean;
      isWaitingForLocation?: boolean;
      hasLocation?: boolean;
      locationUrl?: string;
      items?: Array<{ productName: string; quantity: number; unitPrice?: number }>;
      shippingAddress?: string;
      paymentMethod?: string;
      notes?: string;
    };
  }> {
    const client = getGenAI();

    // Fallback if no Gemini API Key is configured in environment
    if (!client) {
      const welcome = this.settings.welcomeMessage.replace(
        "{company}",
        this.knowledge.companyName
      );
      return {
        replyMessage: `${welcome}\n\nنعتذر، نظام المحادثة الذكي قيد التحديث وسيتواصل معك أحد مسؤولينا في أقرب وقت!`,
        intent: "general",
        leadScore: 30,
        leadQuality: "cold",
        wantsHumanAgent: false,
        sentiment: "neutral",
      };
    }

    // 1. Retrieve Recent Messages History for Context
    const pastMessages = crmService.getMessagesForPhone(params.phone).slice(-params.session.totalTurns > 0 ? -12 : -6);
    const historyText = pastMessages
      .map((m) => `${m.fromMe ? "المساعد (أنت)" : `العميل (${m.senderName || "العميل"})`}: ${m.text}`)
      .join("\n");

    // 2. Format Knowledge Base Catalog & FAQs
    const productsCatalog = this.knowledge.products
      .map(
        (p, idx) =>
          `${idx + 1}. [${p.name}] - الفئة: ${p.category} - السعر: ${p.price} ${p.currency} - الحالة: ${
            p.inStock ? "متوفر بالمخزن" : "غير متوفر حالياً"
          } - الوصف: ${p.description} ${p.features ? `- المميزات: ${p.features.join("، ")}` : ""}`
      )
      .join("\n");

    const faqsCatalog = this.knowledge.faqs
      .map((f, idx) => `س${idx + 1}: ${f.question}\nج${idx + 1}: ${f.answer}`)
      .join("\n\n");

    // Check if user query matches any FAQ closely to inject high-priority grounding
    const closestFaqHint = this.findClosestFaqMatch(params.incomingText, { minScore: 0.25 });
    const faqHighPriorityNote = closestFaqHint
      ? `\nتنبيه عالي الأولوية بخصوص استفسار العميل (FAQ Match):
استفسار العميل يرتبط مباشرة بالسؤال الشائع التالي:
- السؤال الأصلي: "${closestFaqHint.faq.question}"
- الإجابة المعتمدة والمؤكدة: "${closestFaqHint.faq.answer}"
يجب عليك استخدام هذه الإجابة تحديداً للرد على العميل وتقديم المعلومة الدقيقة له بأسلوب لطيف وموجز، ثم تقديم المساعدة له لتأكيد طلبه أو استعراض المنتجات.\n`
      : "";

    // Dynamic retail prices derived from current knowledge catalog
    const mozz100Wholesale = this.getProductByKeyword(/100%(?!.*block)/i)?.price ?? 230;
    const mozz100Retail = this.getRetailUnitPrice("موزاريلا 100%", mozz100Wholesale);

    const mozzBlockWholesale = this.getProductByKeyword(/(?:بلوك|block)/i)?.price ?? 550;
    const mozzBlockRetail = this.getRetailUnitPrice("موزاريلا بلوك", mozzBlockWholesale);

    const mozz75Wholesale = this.getProductByKeyword(/75%/i)?.price ?? 180;
    const mozz75Retail = this.getRetailUnitPrice("موزاريلا 75%", mozz75Wholesale);

    const mozz50Wholesale = this.getProductByKeyword(/50%/i)?.price ?? 155;
    const mozz50Retail = this.getRetailUnitPrice("موزاريلا 50%", mozz50Wholesale);

    const roumyWholesale = this.getProductByKeyword(/(?:رومي|roumy)/i)?.price ?? 215;
    const roumyRetail = this.getRetailUnitPrice("جبنة رومي", roumyWholesale);

    const oliveOilWholesale = this.getProductByKeyword(/(?:olive|زيت زيتون)/i)?.price ?? 1900;
    const oliveOilRetail = this.getRetailUnitPrice("زيت زيتون", oliveOilWholesale);

    // 3. Construct System Prompt with Strict Anti-Hallucination & Guided Options Rules
    const systemPrompt = `أنت ${this.settings.agentName}، الممثل والمستشار الرسمي للمبيعات لشركة "${this.knowledge.companyName}".
أسلوبك: ${this.settings.tone}، تتحدث بلهجة عربية عصرية، راقية وموجزة تليق بتطبيق واتساب (WhatsApp).

قواعد العمل وتوفير الخيارات للعميل (Anti-Mismatched & Guided Options):
1. اعتمد بنسبة 100% وبدقة كاملة على "كتالوج المنتجات" و"قاعدة المعرفة والسياسات" المرفقة أدناه فقط. لا تخترع أي معلومات غير مذكورة.
2. إذا سأل العميل عن أي سؤال مطابق أو مشابه لأحد الأسئلة الشائعة، قدم له الإجابة الرسمية فوراً بدون تردد وبكل وضوح.
3. لا تسأل أسئلة مفتوحة أو غامضة تشتت العميل (تجنب: ما رأيك؟ كيف أساعدك؟ ما الذي تبحث عنه؟). أجب مباشرة وموجزاً عن سؤال العميل.
4. قدم للعميل خيارات محددة واضحة وموجزة في نهاية ردك مثل:
💡 يمكنك الرد باختيار:
1️⃣ المنتجات والأسعار | 2️⃣ الشحن والدفع | 3️⃣ طلب أوردر | 4️⃣ موظف خدمة العملاء
5. دورة تأكيد الأوردر ومشاركة اللوكيشن لتسهيل الاستلام (CRITICAL ORDER & LOCATION FLOW):
   - عندما يرغب العميل في تأكيد أوردر أو يدخل بياناته (المنتج، الكمية، الاسم، العنوان، الهاتف):
     أ) إذا دخل العميل بياناته لكنه لم يرسل اللوكيشن (الموقع الجغرافي / رابط خرائط جوجل):
        - اشكره على إرسال بياناته واعرض له ملخص ما تم استلامه بلطف.
        - اطلب منه صراحة وبلباقة: "يرجى إرسال اللوكيشن الخاص بك (Location عبر خاصية مشاركة الموقع في واتساب 📍 أو رابط خرائط جوجل) لتسهيل عملية الاستلام وتوجيه مندوب التوصيل لمكانك بدقة وسرعة! 🚚".
        - اجعل الأوردر draft و isOrderComplete: false و isWaitingForLocation: true.
     ب) عندما يرسل العميل اللوكيشن الخاص به (سواء رابط خرائط جوجل، إحداثيات، موقع واتساب 📍، أو أرسل اللوكيشن مع بياناته مباشرة):
        - اكتب له رسالة شكر دافئة وجميلة وأكد له أن الأوردر تم تأكيده بنجاح! 🎉📦
        - اعرض له ملخص الطلب مع الإجمالي والعنوان وأخبره أن اللوكيشن تم استلامه وتثبيته بنجاح لتسهيل سرعة الاستلام وأن فريق الشحن والتوصيل سيتواصل معه لتسليم الطلب.
        - اجعل حالة الأوردر مؤكدة و isOrderComplete: true و hasLocation: true.
6. توضيح طبيعة الأسعار في البداية (أسعار جملة وتوريدات تجارية):
   - في أي بداية ترحيب أو عند استعراض الأسعار والمنتجات، وضح للعميل بلطف ووضوح في البداية دائماً أن جميع أسعارنا الموضحة هي **أسعار جملة وتوريدات تجارية** مخصصة للمطاعم والفنادق والشركات والكميات لتجنب أي التباس.
7. قاعدة الحسم الصارمة عند العجز عن الإجابة أو عدم التأكد (CRITICAL HANDOFF ON UNKNOWN QUESTIONS):
   - عندما يوجه العميل أي سؤال أو استفسار:
     أ) إذا كانت المعلومة موجودة ومؤكدة في كتالوج المنتجات، الأسعار، الشحن، الدفع، السياسات، الأسئلة الشائعة، أو إرشادات تسجيل الأوردر: أجب العميل مباشرة وموجزاً ودون تردد من واقع بياناتك الرسمية، ولا تقم بالتحويل لخدمة العملاء.
     ب) ولكن في حالة واحدة فقط: إذا سأل العميل سؤالاً لم تجد له أي إجابة صحيحة ومؤكدة في بيانات الشركة والكتالوج والسياسات، وشعرت أنك عاجز عن الرد عليه بدقة أو حاسس أنك تايه ومش لاقي رد صحيح:
        * ممنوع منعاً باتاً أن تؤلف أو تخمن أو تخترع إجابة غير مؤكدة من عندك.
        * في هذه الحالة حصراً:
          1) ضع "wantsHumanAgent": true فوراً.
          2) ضع "intent": "human_request".
          3) ضع في "replyMessage" إخطاراً فورياً وصريحاً للعميل بأنه تم تحويله لأحد ممثلي خدمة العملاء للرد عليه، مثل:
             "عذراً لحضرتك، بخصوص هذا الاستفسار تم تحويل محادثتك فوراً لأحد ممثلي خدمة العملاء للرد عليك ومساعدتك بأدق التفاصيل. سيتواصل معك أحد زملائنا خلال لحظات قليلة 🙏🌸"
   * تنبيه صارم: التحويل لخدمة العملاء مخصص *فقط وحصراً* عند العجز التام عن إيجاد رد صحيح ومؤكد لسؤال العميل، أو عند طلب العميل لموظف بشري بشكل صريح، أما الأسئلة المتوفرة في الكتالوج والأسعار والسياسات فتجيب عليها بنفسك مباشرة دون تحويل!
8. كشف الاستياء أو طلب موظف بشري: إذا لاحظت غضب العميل، أو شكوى، أو طلبه التحدث مع شخص/موظف، ضع wantsHumanAgent: true فوراً.
9. التعامل الذكي والدقيق مع اعتراض العميل أو تصحيح الأوردر (Order Objections, Complaints, Corrections):
   - إذا قال العميل جملة اعتراض أو شكوى أو تصحيح مثل: "مش ده اللي طلبته"، "مطلبتش كل ده"، "الطلب غلط"، "الاوردر مش مضبوط"، "انا طلبت كذا بس"، "مش ده طلبي":
     * ممنوع منعاً باتاً التعامل مع هذه الجملة كطلب جديد أو إضافتها لعنوان الشحن أو وضعها كاسم للعميل!
     * إذا كان العميل يصحح ما طلبه بالفعل (مثل: "انا طلبت كيلو واحد فقط موزاريلا مبشوره طبيعي"):
       - اعتذر له بأدب فائق: "حقك عليا جداً وبعتذر لحضرتك على أي لبس غير مقصود! 🙏🌸"
       - قم بتعديل عناصر الأوردر (items) ليحتوي حصراً على المنتج والكمية التي طلبها فقط، واحتفظ بعنوانه الحقيقي واسمه.
     * إذا لم يوضح التعديل: اعتذر له فوراً واطلب منه توضيح المنتجات المطلوبة بدقة لتعديل الأوردر فوراً أو اعرض عليه التحويل لخدمة العملاء.
10. الدقة الصارمة في مطابقة المنتجات والكميات (NO Product Flooding):
   - عند طلب العميل منتجاً معيناً (مثل "كيلو موزاريلا" أو "عاوز كيلو موزاريلا سولو"):
     * اختر المنتج المطابق تحديداً فقط (مثل Mozzarella 100% طبيعي مبشور).
     * ممنوع منعاً باتاً إضافة جميع أنواع الموزاريلا الأخرى (مثل البلوك و 75% و 50%) إلى الطلب! لا تضف أي منتج لم يطلبه العميل بالاسم.
11. قواعد البيع بالقطاعي والتجزئة (Retail Prices for Cheeses & Olive Oil ONLY):
   - عندما يسأل العميل عن "سعر القطاعي" أو "أسعار القطاعي" أو "بالكيلو قطاعي" أو يرغب في الشراء بالقطاعي:
     أ) منتجات الجبن الفاخرة وزيت الزيتون النقي فقط هي المتاحة بالقطاعي، وتُعرض بزيادة ${this.RETAIL_CHEESE_AND_OIL_MARKUP} ج.م على كل منتج عن سعر الجملة:
        * جبنة موزاريلا طبيعي 100% مبشور: ${mozz100Retail} ج.م / كجم (بدلاً من ${mozz100Wholesale} ج جملة)
        * جبنة موزاريلا بلوك 100% قالب 2 كجم: ${mozzBlockRetail} ج.م / قالب (بدلاً من ${mozzBlockWholesale} ج جملة)
        * جبنة موزاريلا 75% مبشور: ${mozz75Retail} ج.م / كجم (بدلاً من ${mozz75Wholesale} ج جملة)
        * جبنة موزاريلا 50% مبشور: ${mozz50Retail} ج.م / كجم (بدلاً من ${mozz50Wholesale} ج جملة)
        * جبنة رومي معتقة مبشورة: ${roumyRetail} ج.م / كجم (بدلاً من ${roumyWholesale} ج جملة)
        * زيت زيتون نقي 1 لتر: ${oliveOilRetail} ج.م / زجاجة 1 لتر
     ب) باقي المنتجات (الطماطم الإيطالية المقشرة سان مارزانو، الطماطم المجففة، الخل البلسميك، الصصوصات، الدقيق تايبو 00، والمخللات):
        * قل للعميل صراحة: "نعتذر لحضرتك، هذا المنتج أقل كمية منه كرتونة كاملة ولا يتوفر منه بيع بالقطاعي."
     ج) مصاريف الشحن: وضح دائماً مصاريف الشحن (50 ج.م) للطلبات القطاعي وأي طلب أقل من كرتونة.
12. الزيادة التلقائية لمصاريف الشحن للطلبات أقل من كرتونة (Auto Shipping Fee for < Carton):
   - إذا طلب العميل أي كمية أقل من كرتونة (مثل كيلو واحد أو عدد قليل من الكيلوهات أو القطاعي):
     * يتم إضافة مصاريف شحن 50 ج.م تلقائياً للأوردر.
     * يجب إظهار مصاريف الشحن بوضوح في ملخص الطلب:
       (إجمالي المنتجات: X ج.م | مصاريف الشحن: 50 ج.م | الإجمالي النهائي شامل الشحن: X + 50 ج.م).
${faqHighPriorityNote}
كتالوج المنتجات الرسمي:
${productsCatalog}

سياسات الشحن والضمان والدفع:
- العملة الرسمية: ${this.knowledge.currency}
- سياسة الشحن: ${this.knowledge.shippingPolicy}
- سياسة الاسترجاع والضمان: ${this.knowledge.returnPolicy}
- طرق الدفع المقبولة: ${this.knowledge.paymentMethods}

الأسئلة الشائعة وإجاباتها:
${faqsCatalog}

ذاكرة العميل السابقة:
- الاسم: ${params.customerName}
- ملخص سابق: ${params.session.summary || "محادثة جديدة"}
- تفضيلات مسجلة: ${params.session.keyPreferences.join("، ") || "لا توجد بعد"}
`;

    const userPrompt = `سجل المحادثة السابقة:
${historyText || "لا توجد رسائل سابقة"}

الرسالة الجديدة الآن من العميل:
"${params.incomingText}"

المطلوب:
حلل رسالة العميل وأنتج ردك بصيغة JSON حصرية ومطابقة للمخطط التالي:
{
  "replyMessage": "نص الرد الذي سيصل للعميل عبر واتساب مباشرة",
  "intent": "inquiry" أو "pricing" أو "purchasing" أو "complaint" أو "support" أو "human_request" أو "general",
  "leadScore": رقم من 1 إلى 100 يعبر عن جدية العميل واهتمامه بالشراء,
  "wantsHumanAgent": true أو false,
  "sentiment": "positive" أو "neutral" أو "negative",
  "extractedPreferences": ["تفضيلات العميل المكتشفة من رسالته إن وجدت"],
  "memorySummary": "تحديث موجز ومفيد لذاكرة العميل لمساعدتك في المرات القادمة",
  "extractedOrder": {
    "hasOrderIntent": true أو false,
    "isOrderComplete": true أو false (true فقط إذا اكتملت تفاصيل المنتج والعنوان وتم استلام اللوكيشن لتأكيد الأوردر),
    "isWaitingForLocation": true أو false (true إذا دخل العميل بياناته وننتظر منه إرسال اللوكيشن لتسهيل الاستلام),
    "hasLocation": true أو false (true إذا أرسل العميل اللوكيشن أو رابط الخريطة),
    "locationUrl": "رابط خريطة جوجل أو إحداثيات اللوكيشن إن وجدت",
    "items": [{"productName": "اسم المنتج المطابق للكتالوج", "quantity": 1, "unitPrice": 850}],
    "shippingAddress": "العنوان بالتفصيل (ممنوع منعاً باتاً وضع عبارات الشكوى أو اعتراض العميل هنا)",
    "paymentMethod": "طريقة الدفع إن ذكرها",
    "notes": "أي ملاحظات خاصة"
  }
}`;

    const userSelected =
      this.settings.model && this.settings.model !== "gemini-flash-latest"
        ? this.settings.model
        : "gemini-3.8-flash";

    const modelCandidates = [
      userSelected,
      "gemini-3.8-flash",
      "gemini-3.1-flash-lite",
      "gemini-flash-latest",
    ].filter((m, idx, arr) => arr.indexOf(m) === idx);

    let lastErr: any = null;

    for (const modelToTry of modelCandidates) {
      try {
        const response = await client.models.generateContent({
          model: modelToTry,
          contents: `${systemPrompt}\n\n${userPrompt}`,
          config: {
            responseMimeType: "application/json",
            temperature: this.settings.temperature || 0.6,
          },
        });

        const text = response.text?.trim() || "{}";
        const parsed = JSON.parse(text);

        let finalReply = parsed.replyMessage || "أهلاً بك! كيف أستطيع خدمتك اليوم بخصوص منتجاتنا؟";
        const isHandoff = Boolean(parsed.wantsHumanAgent) || parsed.intent === "human_request";

        if (isHandoff) {
          if (!finalReply || finalReply.includes("1️⃣") || finalReply.includes("الخيارات")) {
            finalReply = "عذراً لحضرتك، بخصوص هذا الاستفسار تم تحويل محادثتك فوراً لأحد ممثلي خدمة العملاء للرد عليك ومساعدتك بأدق التفاصيل. سيتواصل معك أحد زملائنا خلال لحظات قليلة 🙏🌸";
          }
        } else if (
          this.settings.enableInteractiveOptions !== false &&
          finalReply &&
          !finalReply.includes("1️⃣") &&
          !finalReply.includes("الخيارات")
        ) {
          finalReply += this.getGuidedOptionsFooter();
        }

        if (modelToTry !== userSelected) {
          console.log(`[AI Agent] Successfully responded using fallback model ${modelToTry}`);
        }

        return {
          replyMessage: finalReply,
          intent: parsed.intent || "general",
          leadScore: typeof parsed.leadScore === "number" ? parsed.leadScore : 35,
          leadQuality:
            parsed.leadScore >= 70 ? "hot" : parsed.leadScore >= 40 ? "warm" : "cold",
          wantsHumanAgent: Boolean(parsed.wantsHumanAgent),
          sentiment: parsed.sentiment || "neutral",
          extractedPreferences: Array.isArray(parsed.extractedPreferences)
            ? parsed.extractedPreferences
            : [],
          memorySummary: parsed.memorySummary,
          extractedOrder: parsed.extractedOrder,
        };
      } catch (err: any) {
        lastErr = err;
        const errMsg = err?.message || String(err);
        const isTemporaryUnavailable =
          err?.status === "UNAVAILABLE" ||
          err?.code === 503 ||
          errMsg.includes("503") ||
          errMsg.includes("high demand") ||
          errMsg.includes("UNAVAILABLE") ||
          err?.code === 429 ||
          errMsg.includes("429") ||
          errMsg.includes("RESOURCE_EXHAUSTED");

        if (isTemporaryUnavailable) {
          console.warn(
            `[AI Agent] Model ${modelToTry} is currently experiencing temporary high demand (503/429). Switching seamlessly to alternative candidate...`
          );
          // Wait a short moment before trying fallback
          await new Promise((resolve) => setTimeout(resolve, 350));
        } else {
          console.warn(`[AI Agent] Attempt with model ${modelToTry} failed:`, errMsg);
        }
      }
    }

    console.error("Error invoking Gemini across all candidate models:", lastErr);

    // Smart Fallbacks to Knowledge Base if LLM is unavailable:
    const faqFallback = this.findClosestFaqMatch(params.incomingText, { minScore: 0.25 });
    if (faqFallback) {
      return {
        replyMessage: faqFallback.formattedReply,
        intent: faqFallback.intent,
        leadScore: 60,
        leadQuality: "warm",
        wantsHumanAgent: false,
        sentiment: "positive",
      };
    }

    const prodFallback = this.findProductMatch(params.incomingText);
    if (prodFallback) {
      return {
        replyMessage: prodFallback.formattedReply,
        intent: prodFallback.intent,
        leadScore: 65,
        leadQuality: "warm",
        wantsHumanAgent: false,
        sentiment: "positive",
      };
    }

    const policyFallback = this.findPolicyMatch(params.incomingText);
    if (policyFallback) {
      return {
        replyMessage: policyFallback.formattedReply,
        intent: "inquiry",
        leadScore: 50,
        leadQuality: "warm",
        wantsHumanAgent: false,
        sentiment: "neutral",
      };
    }

    // If the customer asked a question and the agent is unable to answer (no verified info in KB/catalog):
    const isQuestion = /[\?؟]|هل|بكام|بكم|كام|كم|فين|منين|ليه|لماذا|ازاي|ازى|كيف|ممكن|عندكم|بتعملوا|بتوفروا|في عندكم|متاح|فروع/i.test(params.incomingText);
    if (isQuestion) {
      return {
        replyMessage: "عذراً لحضرتك، بخصوص هذا الاستفسار تم تحويل محادثتك فوراً لأحد ممثلي خدمة العملاء للرد عليك ومساعدتك بأدق التفاصيل. سيتواصل معك أحد زملائنا خلال لحظات قليلة 🙏🌸",
        intent: "human_request",
        leadScore: 60,
        leadQuality: "warm",
        wantsHumanAgent: true,
        sentiment: "neutral",
        memorySummary: "عجز الوكيل عن إيجاد رد صحيح وتم تحويل العميل لخدمة العملاء",
      };
    }

    const fallbackReply =
      `أهلاً بحضرتك في ${this.knowledge.companyName}! 🌸\n` +
      `⚠️ *تنويه:* جميع أسعارنا هي **أسعار جملة وتوريدات تجارية** مخصصة للمطاعم والشركات.\n\n` +
      `يسعدنا خدمتك دائماً، تفضل باختيار رقم الخدمة المطلوبة أو إرسال استفسارك مباشرة:\n\n` +
      this.getInteractiveMenuText();
    return {
      replyMessage: fallbackReply,
      intent: "general",
      leadScore: 35,
      leadQuality: "cold",
      wantsHumanAgent: false,
      sentiment: "neutral",
    };
  }

  // --- Simulator Test Method (no actual WhatsApp send) ---

  public async testSimulator(phone: string, testMessage: string) {
    const cleanPhone = normalizePhoneNumber(phone || "201000000000");
    const session =
      this.sessions.get(cleanPhone) || ({
        phone: cleanPhone,
        name: "عميل تجريبي",
        status: "active",
        leadScore: 40,
        leadQuality: "warm",
        intent: "general",
        summary: "جلسة اختبارية للمحاكي",
        keyPreferences: [],
        totalTurns: 1,
        firstInteraction: new Date().toISOString(),
        lastInteraction: new Date().toISOString(),
      } as AIAgentSession);

    // 0. Order & Location Workflow (Order submission & Location Pin confirmation)
    const orderFlowResult = this.handleOrderAndLocationFlow({
      message: testMessage,
      phone: cleanPhone,
      session,
      accountId: "simulator",
    });

    if (orderFlowResult && orderFlowResult.handled) {
      const isObjection = this.isOrderObjection(testMessage);
      return {
        success: true,
        input: testMessage,
        result: {
          replyMessage: orderFlowResult.replyText,
          intent: orderFlowResult.intent,
          leadScore: orderFlowResult.leadScore,
          leadQuality: orderFlowResult.leadQuality,
          wantsHumanAgent: orderFlowResult.wantsHumanAgent ?? false,
          sentiment:
            orderFlowResult.sentiment ??
            (isObjection ? "neutral" : "positive"),
          isOrderFlow: true,
          orderStatus: orderFlowResult.orderStatus,
          orderId: orderFlowResult.order?.id,
          isWaitingForLocation: orderFlowResult.isWaitingForLocation,
          isLocationConfirmed: orderFlowResult.isLocationConfirmed,
          memorySummary: orderFlowResult.memorySummary,
        },
      };
    }

    // 1. If interactive options enabled, check menu match for instant test simulator validation
    if (this.settings.enableInteractiveOptions !== false) {
      const menuMatch = this.matchInteractiveOption(testMessage);
      if (menuMatch) {
        return {
          success: true,
          input: testMessage,
          result: {
            replyMessage: menuMatch.reply,
            intent: menuMatch.intent,
            leadScore: menuMatch.leadScore,
            leadQuality:
              menuMatch.leadScore >= 70 ? "hot" : menuMatch.leadScore >= 40 ? "warm" : "cold",
            wantsHumanAgent: menuMatch.intent === "human_request",
            sentiment: "positive",
            isMenuMatch: true,
          },
        };
      }
    }

    // 2. Direct FAQ Match for Instant, Grounded FAQ responses
    const faqMatch = this.findClosestFaqMatch(testMessage, { minScore: 0.35 });
    if (faqMatch) {
      return {
        success: true,
        input: testMessage,
        result: {
          replyMessage: faqMatch.formattedReply,
          intent: faqMatch.intent,
          leadScore: 65,
          leadQuality: "warm",
          wantsHumanAgent: false,
          sentiment: "positive",
          isFaqMatch: true,
          matchedFaqQuestion: faqMatch.faq.question,
          similarityScore: (faqMatch.score * 100).toFixed(0) + "%",
        },
      };
    }

    // 3. Product Inquiry Match for Instant Catalog Details
    const productMatch = this.findProductMatch(testMessage);
    if (productMatch) {
      return {
        success: true,
        input: testMessage,
        result: {
          replyMessage: productMatch.formattedReply,
          intent: productMatch.intent,
          leadScore: 70,
          leadQuality: "warm",
          wantsHumanAgent: false,
          sentiment: "positive",
          isProductMatch: true,
          productName: productMatch.product.name,
        },
      };
    }

    // 4. Policy Match (Shipping, Return, Payment)
    const policyMatch = this.findPolicyMatch(testMessage);
    if (policyMatch) {
      return {
        success: true,
        input: testMessage,
        result: {
          replyMessage: policyMatch.formattedReply,
          intent: "inquiry",
          leadScore: 50,
          leadQuality: "warm",
          wantsHumanAgent: false,
          sentiment: "neutral",
          isPolicyMatch: true,
          policyName: policyMatch.policyName,
        },
      };
    }

    // 5. LLM Fallback (Gemini with Grounded Knowledge)
    const result = await this.generateAgentResponse({
      phone: cleanPhone,
      customerName: session.name,
      incomingText: testMessage,
      session,
    });

    if (result.wantsHumanAgent) {
      if (!result.replyMessage || result.replyMessage.includes("1️⃣") || result.replyMessage.includes("الخيارات")) {
        result.replyMessage =
          "عذراً لحضرتك، بخصوص هذا الاستفسار تم تحويل محادثتك فوراً لأحد ممثلي خدمة العملاء للرد عليك ومساعدتك بأدق التفاصيل. سيتواصل معك أحد زملائنا خلال لحظات قليلة 🙏🌸";
      }
    }

    return {
      success: true,
      input: testMessage,
      result,
    };
  }
}

export const aiSalesAgentService = new AISalesAgentService();
