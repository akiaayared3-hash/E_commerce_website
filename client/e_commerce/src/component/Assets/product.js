// src/component/Assets/product.js
// Every product: id (number), name, category, image, images, description, new_price, old_price.
//
// PHOTO FORMAT (same for every product):
//   image  = the FRONT photo (used on cards, related products, wishlist)
//   images = [front, back, left, right]  (shown as thumbnails on the product page)
//
// HOW TO ADD THE EXTRA PHOTOS OF A PRODUCT:
//   1. put the files next to the other images, named  <name>_back.jpeg,
//      <name>_left.jpeg, <name>_right.jpeg   (example: belt_back.jpeg)
//   2. uncomment its 3 import lines in the EXTRA PHOTOS block below
//   3. in the product, change   images: [belt],
//                         to    images: [belt, beltBack, beltLeft, beltRight],
//   Use only the photos you have (example: [belt, beltBack]).
//   Never repeat the same photo, and a maximum of 6 are shown.

// NOTE: the _back / _left / _right files are PLACEHOLDERS. Replace them with real
// photos using the SAME file names and nothing in this file needs to change.

import { withStock } from "./stock.js";

import comingSon from "./comingSoon.jpeg";
import belt from "./belt.jpeg";
import hate from "./hat.jpeg";
import hudi from "./hudi.jpeg";
import jacket1 from "./jacke1.jpeg";
import full from "./full.jpeg";

import compleat from "./complet.jpeg";
import compleat2 from "./complet2.jpeg";
import compleat3 from "./complet3.jpeg";
import compleat4 from "./complet4.jpeg";

import jens from "./jens.jpeg";
import jens2 from "./jens2.jpeg";
import jens3 from "./jens3.jpeg";
import jens4 from "./jens4.jpeg";
import shemiz from "./shemiz1.jpeg";

import shose1 from "./shoes1.jpeg";
import shose2 from "./shoes2.jpeg";
import shose3 from "./shoes3.jpeg";
import shose4 from "./shoes4.jpeg";
import shose5 from "./shoes5.jpeg";
import shose6 from "./shoes6.jpeg";
import shose7 from "./shoes7.jpeg";

import tishert from "./t_shirt.jpeg";
import tishert1 from "./t_shirt1.jpeg";
import tishert2 from "./t_shirt2.jpeg";
import tishert3 from "./t_shirt3.jpeg";
import tishert4 from "./t_shirt4.jpeg";
import tishert5 from "./t_shirt5.jpeg";
import tishert6 from "./t_shirt6.jpeg";
import tishert7 from "./t_shirt7.jpeg";
import tishert9 from "./t_shirt9.jpeg";

import tuta1 from "./tuta1.jpeg";
import tuta2 from "./tuta2.jpeg";
import tuta3 from "./tuta3.jpeg";
import tuta4 from "./tuta4.jpeg";
import boxer from "./boxer.jpeg";

// ---------- EXTRA PHOTOS (placeholders for now) ----------
import beltBack from "./belt_back.jpeg";
import beltLeft from "./belt_left.jpeg";
import beltRight from "./belt_right.jpeg";

import hateBack from "./hate_back.jpeg";
import hateLeft from "./hate_left.jpeg";
import hateRight from "./hate_right.jpeg";

import hudiBack from "./hudi_back.jpeg";
import hudiLeft from "./hudi_left.jpeg";
import hudiRight from "./hudi_right.jpeg";

import jacket1Back from "./jacket1_back.jpeg";
import jacket1Left from "./jacket1_left.jpeg";
import jacket1Right from "./jacket1_right.jpeg";

import fullBack from "./full_back.jpeg";
import fullLeft from "./full_left.jpeg";
import fullRight from "./full_right.jpeg";

import compleatBack from "./complet_back.jpeg";
import compleatLeft from "./complet_left.jpeg";
import compleatRight from "./complet_right.jpeg";

import compleat2Back from "./complet2_back.jpeg";
import compleat2Left from "./complet2_left.jpeg";
import compleat2Right from "./complet2_right.jpeg";

import compleat3Back from "./complet3_back.jpeg";
import compleat3Left from "./complet3_left.jpeg";
import compleat3Right from "./complet3_right.jpeg";

import compleat4Back from "./complet4_back.jpeg";
import compleat4Left from "./complet4_left.jpeg";
import compleat4Right from "./complet4_right.jpeg";

import jensBack from "./jens_back.jpeg";
import jensLeft from "./jens_left.jpeg";
import jensRight from "./jens_right.jpeg";

import jens2Back from "./jens2_back.jpeg";
import jens2Left from "./jens2_left.jpeg";
import jens2Right from "./jens2_right.jpeg";

import jens3Back from "./jens3_back.jpeg";
import jens3Left from "./jens3_left.jpeg";
import jens3Right from "./jens3_right.jpeg";

import jens4Back from "./jens4_back.jpeg";
import jens4Left from "./jens4_left.jpeg";
import jens4Right from "./jens4_right.jpeg";

import shemizBack from "./shemiz1_back.jpeg";
import shemizLeft from "./shemiz1_left.jpeg";
import shemizRight from "./shemiz1_right.jpeg";

import shose1Back from "./shoes1_back.jpeg";
import shose1Left from "./shoes1_left.jpeg";
import shose1Right from "./shoes1_right.jpeg";

import shose2Back from "./shoese2_back.jpeg";
import shose2Left from "./shoese2_left.jpeg";
import shose2Right from "./shoese2_right.jpeg";

import shose3Back from "./shose3_back.jpeg";
import shose3Left from "./shose3_left.jpeg";
import shose3Right from "./shose3_right.jpeg";

import shose4Back from "./shose4_back.jpeg";
import shose4Left from "./shose4_left.jpeg";
import shose4Right from "./shose4_right.jpeg";

import shose5Back from "./shose5_back.jpeg";
import shose5Left from "./shose5_left.jpeg";
import shose5Right from "./shose5_right.jpeg";

import shose6Back from "./shose6_back.jpeg";
import shose6Left from "./shose6_left.jpeg";
import shose6Right from "./shose6_right.jpeg";

import shose7Back from "./shose7_back.jpeg";
import shose7Left from "./shose7_left.jpeg";
import shose7Right from "./shose7_right.jpeg";

import tishertBack from "./tishert_back.jpeg";
import tishertLeft from "./tishert_left.jpeg";
import tishertRight from "./tishert_right.jpeg";

import tishert1Back from "./tishert1_back.jpeg";
import tishert1Left from "./tishert1_left.jpeg";
import tishert1Right from "./tishert1_right.jpeg";

import tishert2Back from "./tishert2_back.jpeg";
import tishert2Left from "./tishert2_left.jpeg";
import tishert2Right from "./tishert2_right.jpeg";

import tishert3Back from "./tishert3_back.jpeg";
import tishert3Left from "./tishert3_left.jpeg";
import tishert3Right from "./tishert3_right.jpeg";

import tishert5Back from "./tishert5_back.jpeg";
import tishert5Left from "./tishert5_left.jpeg";
import tishert5Right from "./tishert5_right.jpeg";

import tishert6Back from "./tishert6_back.jpeg";
import tishert6Left from "./tishert6_left.jpeg";
import tishert6Right from "./tishert6_right.jpeg";

import tishert7Back from "./tishert7_back.jpeg";
import tishert7Left from "./tishert7_left.jpeg";
import tishert7Right from "./tishert7_right.jpeg";

import tishert9Back from "./tishert9_back.jpeg";
import tishert9Left from "./tishert9_left.jpeg";
import tishert9Right from "./tishert9_right.jpeg";

import tishert10Back from "./tishert10_back.jpeg";
import tishert10Left from "./tishert10_left.jpeg";
import tishert10Right from "./tishert10_right.jpeg";

import tuta1Back from "./tuta1_back.jpeg";
import tuta1Left from "./tuta1_left.jpeg";
import tuta1Right from "./tuta1_right.jpeg";

import tuta2Back from "./tuta2_back.jpeg";
import tuta2Left from "./tuta2_left.jpeg";
import tuta2Right from "./tuta2_right.jpeg";

import tuta3Back from "./tuta3_back.jpeg";
import tuta3Left from "./tuta3_left.jpeg";
import tuta3Right from "./tuta3_right.jpeg";

import tuta4Back from "./tuta4_back.jpeg";
import tuta4Left from "./tuta4_left.jpeg";
import tuta4Right from "./tuta4_right.jpeg";

import boxerBack from "./tishert8_back.jpeg";
import boxerLeft from "./tishert8_left.jpeg";
import boxerRight from "./tishert8_right.jpeg";

const baseProducts = [
  {
    id: 1,
    name: "comingSon",
    category: "clothes",
    image: comingSon,
    description: "Our newest arrival, coming soon.",
    // no prices yet: the page shows "ETB --"
  },
  {
    id: 2,
    name: "belt",
    category: "clothes", // tip: use "accessories" so no size buttons are required
    image: belt,
    images: [belt, beltBack, beltLeft, beltRight],
    description: "A classic belt, the finishing touch for any men's outfit.",
    new_price: 150,
    old_price: 200,
  },
  {
    id: 3,
    name: "hate",
    category: "clothes", // tip: use "accessories" so no size buttons are required
    image: hate,
    images: [hate, hateBack, hateLeft, hateRight],
    description: "A stylish hat that completes a beautiful outfit.",
    new_price: 250,
    old_price: 280,
  },
  {
    id: 4,
    name: "hudi",
    category: "clothes",
    image: hudi,
    images: [hudi, hudiBack, hudiLeft, hudiRight],
    description: "Soft cotton hoodie, comfortable for every day.",
    new_price: 3200,
    old_price: 3500,
  },
  {
    id: 5,
    name: "jacket",
    category: "clothes",
    image: jacket1,
    images: [jacket1, jacket1Back, jacket1Left, jacket1Right],
    description: "A graceful jacket with a clean, elegant cut.",
    new_price: 4000,
    old_price: 4200,
  },
  {
    id: 6,
    name: "full outfit",
    category: "clothes",
    image: full,
    images: [full, fullBack, fullLeft, fullRight],
    description: "A complete, nicely matched full outfit.",
    new_price: 10050,
    old_price: 10200,
  },
  {
    id: 7,
    name: "compleat",
    category: "clothes",
    image: compleat,
    images: [compleat, compleatBack, compleatLeft, compleatRight],
    description: "A complete men's outfit, ready to wear.",
    new_price: 6500,
    old_price: 7200,
  },
  {
    id: 8,
    name: "full packages",
    category: "clothes",
    image: compleat2,
    images: [compleat2, compleat2Back, compleat2Left, compleat2Right],
    description: "A relaxed outfit package, perfect for the weekend.",
    new_price: 3500,
    old_price: 3700,
  },
  {
    id: 9,
    name: "tuta",
    category: "clothes",
    image: compleat3,
    images: [compleat3, compleat3Back, compleat3Left, compleat3Right],
    description: "A stylish men's outfit.",
    new_price: 150, // check: same as the belt, probably a placeholder
    old_price: 200,
  },
  {
    id: 10,
    name: "compleat",
    category: "clothes",
    image: compleat4,
    images: [compleat4, compleat4Back, compleat4Left, compleat4Right],
    description: "A stylish men's outfit.",
    new_price: 150, // check: same as the belt, probably a placeholder
    old_price: 200,
  },
  {
    id: 11,
    name: "package of jense",
    category: "clothes",
    image: jens,
    images: [jens, jensBack, jensLeft, jensRight],
    description: "A jeans package, a great men's outfit.",
    new_price: 2500,
    old_price: 2900,
  },
  {
    id: 12,
    name: "bagi",
    category: "clothes",
    image: jens2,
    images: [jens2, jens2Back, jens2Left, jens2Right],
    description: "Fashionable, nice clothes.",
    new_price: 4000,
    old_price: 4200,
  },
  {
    id: 13,
    name: "bagi",
    category: "clothes",
    image: jens3,
    images: [jens3, jens3Back, jens3Left, jens3Right],
    description: "Fashionable cotton clothes.",
    new_price: 4000,
    old_price: 4200,
  },
  {
    id: 14,
    name: "bagi",
    category: "clothes",
    image: jens4,
    images: [jens4, jens4Back, jens4Left, jens4Right],
    description: "A stylish men's outfit.",
    new_price: 4500,
    old_price: 4600,
  },
  {
    id: 15,
    name: "shemize",
    category: "clothes",
    image: shemiz,
    images: [shemiz, shemizBack, shemizLeft, shemizRight],
    description: "A neat men's shirt.",
    new_price: 2050,
    old_price: 2200,
  },
  {
    id: 16,
    name: "sinker",
    category: "shoes",
    image: shose1,
    images: [shose1, shose1Back, shose1Left, shose1Right],
    description: "Sneakers that match any suit or casual outfit.",
    new_price: 4250,
    old_price: 4500,
  },
  {
    id: 17,
    name: "shoes",
    category: "shoes",
    image: shose2,
    images: [shose2, shose2Back, shose2Left, shose2Right],
    description: "Shoes with a cool design.",
    new_price: 6550,
    old_price: 6800,
  },
  {
    id: 18,
    name: "jordan",
    category: "shoes",
    image: shose3,
    images: [shose3, shose3Back, shose3Left, shose3Right],
    description: "Classic Jordan style for men.",
    new_price: 6050,
    old_price: 6200,
  },
  {
    id: 19,
    name: "Airforce",
    category: "shoes",
    image: shose4,
    images: [shose4, shose4Back, shose4Left, shose4Right],
    description: "Classic Air Force style for men.",
    new_price: 6000,
    old_price: 6200,
  },
  {
    id: 20,
    name: "sport shoes",
    category: "shoes",
    image: shose6,
    images: [shose6, shose6Back, shose6Left, shose6Right],
    description: "Comfortable sport shoes.",
    new_price: 7050,
    old_price: 7300,
  },
  {
    id: 21,
    name: "campus",
    category: "shoes",
    image: shose5,
    images: [shose5, shose5Back, shose5Left, shose5Right],
    description: "Campus-style shoes for everyday wear.",
    new_price: 5500,
    old_price: 5700,
  },
  {
    id: 22,
    name: "campus",
    category: "shoes",
    image: shose7,
    images: [shose7, shose7Back, shose7Left, shose7Right],
    description: "Campus-style shoes for everyday wear.",
    new_price: 5550,
    old_price: 5800,
  },
  {
    id: 23,
    name: "stock many t-shirt",
    category: "t_shirt",
    image: tishert,
    images: [tishert, tishertBack, tishertLeft, tishertRight],
    description: "A great men's T-shirt.",
    new_price: 1050,
    old_price: 1200,
  },
  {
    id: 24,
    name: "T_shirt",
    category: "t_shirt",
    image: tishert1,
    images: [tishert1, tishert1Back, tishert1Left, tishert1Right],
    description: "A colorful T-shirt.",
    new_price: 1000,
    old_price: 1200,
  },
  {
    id: 25,
    name: "T_shirt",
    category: "t_shirt",
    image: tishert2,
    images: [tishert2, tishert2Back, tishert2Left, tishert2Right],
    description: "A T-shirt with a cool design.",
    new_price: 2000,
    old_price: 2200,
  },
  {
    id: 26,
    name: "T_shirt",
    category: "t_shirt",
    image: tishert3,
    images: [tishert3, tishert3Back, tishert3Left, tishert3Right],
    description: "A comfortable, high-quality T-shirt.",
    new_price: 2500,
    old_price: 2700,
  },
  {
    id: 27,
    name: "T_shirt",
    category: "t_shirt",
    image: tishert5,
    images: [tishert5, tishert5Back, tishert5Left, tishert5Right],
    description: "A great men's T-shirt.",
    new_price: 1000,
    old_price: 1100,
  },
  {
    id: 28,
    name: "T_shirt",
    category: "t_shirt",
    image: tishert6,
    images: [tishert6, tishert6Back, tishert6Left, tishert6Right],
    description: "A T-shirt with a nice design.",
    new_price: 1800, // check: higher than old_price, probably a typo
    old_price: 1700,
  },
  {
    id: 29,
    name: "T_shirt",
    category: "t_shirt",
    image: tishert7,
    images: [tishert7, tishert7Back, tishert7Left, tishert7Right],
    description: "A T-shirt with a full, nice design.",
    new_price: 2150,
    old_price: 2200,
  },
  {
    id: 30,
    name: "T_shirt",
    category: "t_shirt",
    image: tishert9,
    images: [tishert9, tishert9Back, tishert9Left, tishert9Right],
    description: "A T-shirt with a cool design.",
    new_price: 1050,
    old_price: 1200,
  },
  {
    id: 31,
    name: "T_shirt",
    category: "t_shirt",
    image: tishert4,
    images: [tishert4, tishert10Back, tishert10Left, tishert10Right],
    description: "A cool men's T-shirt.",
    new_price: 1000,
    old_price: 1000,
  },
  {
    id: 32,
    name: "tuta",
    category: "clothes",
    image: tuta1,
    images: [tuta1, tuta1Back, tuta1Left, tuta1Right],
    description: "A stylish men's tracksuit.",
    new_price: 7150,
    old_price: 7200,
  },
  {
    id: 33,
    name: "beautiful tuta",
    category: "clothes",
    image: tuta2,
    images: [tuta2, tuta2Back, tuta2Left, tuta2Right],
    description: "A beautiful men's tracksuit.",
    new_price: 6650,
    old_price: 6800,
  },
  {
    id: 34,
    name: "quality and comfortable tuta",
    category: "clothes",
    image: tuta3,
    images: [tuta3, tuta3Back, tuta3Left, tuta3Right],
    description: "A cool design and a great outfit.",
    new_price: 5500,
    old_price: 5800,
  },
  {
    id: 35,
    name: "best outfit tuta",
    category: "clothes",
    image: tuta4,
    images: [tuta4, tuta4Back, tuta4Left, tuta4Right],
    description: "A great men's tracksuit outfit.",
    new_price: 6050,
    old_price: 6200,
  },
  {
    id: 36,
    name: "boxer",
    category: "clothes",
    image: boxer,
    images: [boxer, boxerBack, boxerLeft, boxerRight],
    description: "High-quality boxers.",
    new_price: 750,
    old_price: 800,
  },
];

export const categories = withStock(baseProducts);