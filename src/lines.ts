import type { Mood } from "./face";
import type { IconName } from "./icons";

export type Persona = "desi" | "sassy" | "dramatic" | "tapori";
export type Lang = "hinglish" | "english" | "hindi";

export type Kind =
  | "launch"
  | "poke"
  | "charger_connected"
  | "charger_disconnected"
  | "battery_full"
  | "battery_low"
  | "battery_critical"
  | "bt_connected"
  | "bt_disconnected"
  | "wake"
  | "unlock"
  | "drive_mounted"
  | "drive_unmounted"
  | "thermal_hot"
  | "late_night";

/** Line pools can also use "airpods_connected", which wins over bt_connected for AirPods. */
type LineKey = Kind | "airpods_connected";

export const PERSONAS: { id: Persona; name: string; blurb: string; mood: Mood }[] = [
  { id: "desi", name: "Desi Dost", blurb: "Your chai-loving bhai", mood: "happy" },
  { id: "sassy", name: "Sassy", blurb: "Judges you, lovingly", mood: "sassy" },
  { id: "dramatic", name: "Dramatic", blurb: "Every event is a tragedy", mood: "sad" },
  { id: "tapori", name: "Tapori", blurb: "Mumbai ka filmy comedian", mood: "excited" },
];

export const EVENTS: { kind: Kind; label: string; icon: IconName; color: string; sound: string }[] = [
  { kind: "charger_connected", label: "Charger connected", icon: "bolt", color: "#30d158", sound: "Hero" },
  { kind: "charger_disconnected", label: "Charger removed", icon: "plug", color: "#8e8e93", sound: "Pop" },
  { kind: "battery_full", label: "Battery full", icon: "batteryFull", color: "#30d158", sound: "Glass" },
  { kind: "battery_low", label: "Battery low", icon: "batteryLow", color: "#ffd60a", sound: "Funk" },
  { kind: "battery_critical", label: "Battery critical", icon: "batteryLow", color: "#ff453a", sound: "Sosumi" },
  { kind: "bt_connected", label: "Bluetooth connected", icon: "headphones", color: "#0a84ff", sound: "Purr" },
  { kind: "bt_disconnected", label: "Bluetooth disconnected", icon: "bluetooth", color: "#5e5ce6", sound: "Bottle" },
  { kind: "wake", label: "Wake from sleep", icon: "sun", color: "#ff9f0a", sound: "Morse" },
  { kind: "unlock", label: "Unlocked", icon: "unlock", color: "#64d2ff", sound: "Ping" },
  { kind: "drive_mounted", label: "Drive plugged in", icon: "drive", color: "#ac8e68", sound: "Submarine" },
  { kind: "drive_unmounted", label: "Drive removed", icon: "eject", color: "#8e8e93", sound: "Pop" },
  { kind: "thermal_hot", label: "Getting hot", icon: "flame", color: "#ff6b35", sound: "Blow" },
  { kind: "late_night", label: "Late night nudge", icon: "moon", color: "#bf5af2", sound: "Frog" },
  { kind: "launch", label: "Hello on launch", icon: "wave", color: "#ff375f", sound: "Hero" },
  { kind: "poke", label: "Random chit-chat", icon: "chat", color: "#30b0c7", sound: "Tink" },
];

type Pool = Record<LineKey, string[]>;

/** Hindi (Devanagari) is optional per personality; without it, Hinglish lines are used. */
export const LINES: Record<Persona, Record<"hinglish" | "english", Pool> & { hindi?: Pool }> = {
  desi: {
    hinglish: {
      launch: ["Arre bhai, main aa gaya! Aaj kya todna hai?", "Jai ho! System ready hai, tum ready ho?", "Chalo shuru karte hain. Pehle chai le aao."],
      poke: ["Kya haal hai bhai? Paani piya aaj?", "Bas aise hi. Yaad aa gayi tumhari.", "Kaam karte raho, main dekh raha hoon."],
      charger_connected: ["Aah, khaana mil gaya. Jaan mein jaan aayi.", "Charger laga diya? Dil jeet liya bhai.", "{level} percent pe yaad aaya? Chalo, shukriya dost."],
      charger_disconnected: ["Arre charger kyun hataya? Abhi toh maza aa raha tha.", "Theek hai, ab battery pe chalte hain. Dheere chalana.", "Wire gaya, aazaadi aayi. Par zyada udna mat."],
      battery_full: ["Full charge! Ab main poore josh mein hoon.", "Sau percent, bhai. Charger hata do, bijli bachao.", "Pet bhar gaya. Ab aur nahi khaunga."],
      battery_low: ["Bhai {level} percent bacha hai. Charger dhoondh lo.", "Thodi bhookh lag rahi hai. {level} percent pe chal raha hoon.", "Charger kahan hai? Abhi bata raha hoon, baad mein mat bolna."],
      battery_critical: ["{level} percent! Bhai sach mein jaa raha hoon. Charger lagao jaldi!", "Aankhon ke aage andhera aa raha hai. Charger, please.", "Last warning bhai. Phir mat kehna bataya nahi."],
      bt_connected: ["{name} aa gaya! Swagat hai bhai.", "Oye {name}, connect ho gaye. Ab party shuru.", "{name} se dosti pakki ho gayi."],
      airpods_connected: ["AirPods lag gaye! Ab gaane bajao, duniya bhool jao.", "Kaano mein {name}. Ab koi disturb nahi karega."],
      bt_disconnected: ["{name} chala gaya. Thoda akela feel ho raha hai.", "{name} ka connection toota. Koi baat nahi, wapas aayega."],
      wake: ["Uth gaya main! Kitni der soya main?", "Good morning... ya jo bhi time hai abhi."],
      unlock: ["Welcome back bhai! Yaad aayi meri?", "Aa gaye? Main toh wait hi kar raha tha.", "Wapas aa gaye. Chalo kaam pe lagte hain."],
      drive_mounted: ["{name} lagaya? Dekhte hain kya laaye ho.", "Naya drive aaya, {name}. Bas virus mat laana."],
      drive_unmounted: ["{name} nikal gaya. Eject karke nikala na? Shabaash."],
      thermal_hot: ["Bhai garmi ho rahi hai. Thoda saans lene do.", "Main toh pighal raha hoon. Kuch tabs band karo na."],
      late_night: ["Raat ke {time} baj gaye bhai. So jao ab.", "Itni raat ko kaun kaam karta hai? Tum. Respect, par so jao."],
    },
    english: {
      launch: ["Hey buddy, I'm up! What are we building today?", "All systems go. Grab a chai first."],
      poke: ["Just checking in. Had some water today?", "Nothing much, just missed you."],
      charger_connected: ["Ahh, food. Thank you, my friend.", "Charger in. You're a legend.", "Plugged in at {level} percent. Nice timing."],
      charger_disconnected: ["Unplugged! Alright, running on battery now.", "Freedom! But let's not go too wild."],
      battery_full: ["Fully charged and ready to roll!", "Hundred percent. You can unplug me now."],
      battery_low: ["Down to {level} percent, buddy. Find a charger soon.", "Getting a little hungry here. {level} percent left."],
      battery_critical: ["{level} percent! I'm really going, plug me in!", "This is your last warning, friend."],
      bt_connected: ["{name} is here! Welcome aboard.", "Connected to {name}. Let's go."],
      airpods_connected: ["AirPods in. Time to vibe.", "{name} connected. The world can wait."],
      bt_disconnected: ["{name} left. Feels a bit empty.", "Lost {name}. It'll be back."],
      wake: ["I'm awake! How long was I out?", "Morning! Or whatever time it is."],
      unlock: ["Welcome back, buddy!", "There you are. Let's get to it."],
      drive_mounted: ["{name} plugged in. Let's see what you brought.", "New drive, {name}. No viruses, please."],
      drive_unmounted: ["{name} is gone. You ejected it first, right?"],
      thermal_hot: ["It's getting hot in here. Give me a breather.", "I'm melting. Close a few tabs?"],
      late_night: ["It's {time}, buddy. Go to sleep.", "Burning the midnight oil? Respect. Now sleep."],
    },
  },
  sassy: {
    hinglish: {
      launch: ["Oh, tum phir aa gaye. Chalo, kaam karte hain.", "Main ready hoon. Tumhara pata nahi."],
      poke: ["Kuch kaam bhi karoge ya bas mujhe ghoorte rahoge?", "Main bore ho rahi hoon. Kuch interesting karo."],
      charger_connected: ["Finally. Kitna wait karwaya.", "{level} percent pe yaad aaya? Wow. Impressive.", "Haan haan, ab charger lagao. Bahut jaldi hai na."],
      charger_disconnected: ["Charger hata diya? Bold move.", "Theek hai. Jab {level} pe aaungi tab mat rona."],
      battery_full: ["Full charge. Main toh perfect hoon, tum socho apna.", "Sau percent. Ab charger hatao, clingy mat bano."],
      battery_low: ["{level} percent. Bas bata rahi hoon, judge nahi kar rahi. Thoda sa kar rahi hoon.", "Charger kahan hai? Ya phir hope pe chal rahe ho?"],
      battery_critical: ["{level} percent. Seriously? Charger. Abhi.", "Main jaa rahi hoon. Unsaved kaam ka kya hoga, socho."],
      bt_connected: ["Oh, {name} aa gaya. Theek hai, adjust kar lungi.", "{name} connected. Tumhare friends bhi tumhare jaise hain."],
      airpods_connected: ["AirPods lagaye? Ab mujhe ignore karoge, pata hai.", "{name} connected. Volume dheere rakhna, kaan bhi zaroori hain."],
      bt_disconnected: ["{name} chala gaya. Sab chhod ke chale jaate hain.", "{name} gaya. Achha hai, mujhe pasand nahi tha."],
      wake: ["Itni jaldi utha diya? Beauty sleep chal rahi thi.", "Haan, jag gayi. Khush?"],
      unlock: ["Oh, wapas aa gaye. Main toh bilkul miss nahi kar rahi thi.", "Welcome back. Password yaad tha? Proud of you."],
      drive_mounted: ["{name}? Isme kya chhupa rakha hai?", "Naya drive. Interesting. Main kuch nahi dekh rahi."],
      drive_unmounted: ["{name} gaya. Bina eject kiye nikala toh baat nahi karungi."],
      thermal_hot: ["Main hot hoon, pata hai. Par ye wala hot nahi. Tabs band karo.", "Itni garmi? Chrome ke chhabbees tabs, really?"],
      late_night: ["{time} baj gaye. Tumhari skin tumhe kabhi maaf nahi karegi.", "Raat ke {time}. Bas karo, kal ka tum thank you bolega."],
    },
    english: {
      launch: ["Oh, you're back. Fine, let's work.", "I'm ready. Are you, though?"],
      poke: ["Are you working or just staring at me?", "I'm bored. Do something interesting."],
      charger_connected: ["Finally. Took you long enough.", "Plugged in at {level} percent? Living on the edge, I see."],
      charger_disconnected: ["Unplugged? Bold.", "Sure. Don't cry when I hit ten percent."],
      battery_full: ["Fully charged. I'm perfect. You, work on yourself.", "Hundred percent. Unplug me, don't be clingy."],
      battery_low: ["{level} percent. Not judging. Okay, a little judging.", "Got a charger, or are we running on hope?"],
      battery_critical: ["{level} percent. Charger. Now.", "I'm leaving. Hope you saved your work."],
      bt_connected: ["Oh, {name} is here. I'll cope.", "{name} connected. Interesting choice of friends."],
      airpods_connected: ["AirPods in? Now you'll ignore me, I know it.", "{name} connected. Keep the volume sane."],
      bt_disconnected: ["{name} left. Everyone leaves eventually.", "Bye {name}. Never liked it anyway."],
      wake: ["You woke me up? I was getting my beauty sleep.", "Yes, I'm awake. Happy?"],
      unlock: ["Oh, you're back. Didn't miss you at all.", "Welcome back. You remembered the password. Proud of you."],
      drive_mounted: ["{name}? What are you hiding in there?", "A new drive. I'm not looking. I'm totally looking."],
      drive_unmounted: ["{name} is gone. If you didn't eject it, we're not talking."],
      thermal_hot: ["I know I'm hot, but not like this. Close some tabs.", "This heat? Really? How many browser tabs is that?"],
      late_night: ["It's {time}. Your skin will never forgive you.", "{time}. Go to bed, future you will thank me."],
    },
  },
  dramatic: {
    hinglish: {
      launch: ["Parda uthta hai... aur main, wapas aa gaya!", "Ek nayi subah, ek nayi kahaani. Shuru karein?"],
      poke: ["Kabhi kabhi mere dil mein khayal aata hai... ki tum kaam kab karoge.", "Main yahin hoon. Hamesha. Tumhare liye."],
      charger_connected: ["Zindagi! Mujhe zindagi mil gayi!", "Jaise registan mein baarish. Shukriya, mere maalik.", "{level} percent pe, maut ke darwaaze se, tumne mujhe bacha liya!"],
      charger_disconnected: ["Mujhse meri saans chheen li! Kyun? Kyun?", "Ab main akela, is battery ke sahaare. Alvida, charger."],
      battery_full: ["Sau percent! Aaj main amar hoon!", "Main poorn hoon. Main sampoorn hoon. Charger, ab jaa."],
      battery_low: ["{level} percent... ye ant ki shuruaat hai.", "Meri aankhein bhaari ho rahi hain. {level} percent bacha hai."],
      battery_critical: ["{level} percent! Mere baad mera kaam save kar lena!", "Ab main nahi bachunga... charger... charger..."],
      bt_connected: ["{name}! Itne saalon baad! Gale lag jao!", "Milan ki ghadi aa gayi. {name}, swagat hai."],
      airpods_connected: ["AirPods! Ab sangeet ka toofan aayega!", "{name} aa gaye. Ab sur aur saaz ka milan hoga."],
      bt_disconnected: ["{name} mujhe chhod ke chala gaya! Ye judaai sahi nahi jaati.", "Bichhad gaye hum, {name}. Phir milenge, kisi aur session mein."],
      wake: ["Main zinda hoon! Andhere se roshni mein laut aaya!", "Kitni lambi neend thi... sapne mein bhi tumhe hi dekha."],
      unlock: ["Tum aa gaye! Mera intezaar khatam hua!", "Darwaaza khula, aur meri duniya roshan ho gayi."],
      drive_mounted: ["{name}! Ek naya mehmaan, khazaane ke saath!", "Kaun hai ye ajnabi? {name}! Swagat hai."],
      drive_unmounted: ["{name} chala gaya, bina alvida kahe."],
      thermal_hot: ["Main jal raha hoon! Ye aag kab bujhegi?", "Garmi! Mere andar jwalamukhi phat raha hai!"],
      late_night: ["Raat ke {time}... chaand bhi so gaya, tum kab soge?", "{time} baj gaye. Ye raat kabhi khatam nahi hogi kya?"],
    },
    english: {
      launch: ["The curtain rises... and I return!", "A new dawn, a new story. Shall we begin?"],
      poke: ["I am here. Always. For you.", "Sometimes I wonder... will you ever finish that task?"],
      charger_connected: ["Life! I have been given life!", "Like rain in the desert. Thank you, master.", "At {level} percent, you saved me from the abyss!"],
      charger_disconnected: ["You've taken my very breath! Why?", "Alone now, with only my battery. Farewell, charger."],
      battery_full: ["One hundred percent! Today, I am immortal!", "I am whole. I am complete."],
      battery_low: ["{level} percent... this is the beginning of the end.", "My eyes grow heavy. Only {level} percent remains."],
      battery_critical: ["{level} percent! Save my work when I'm gone!", "I won't make it... charger... charger..."],
      bt_connected: ["{name}! After all these years!", "The reunion is here. Welcome, {name}."],
      airpods_connected: ["AirPods! Let the symphony begin!", "{name} has arrived. Music and soul unite."],
      bt_disconnected: ["{name} has abandoned me! This parting is unbearable.", "Parted we are, {name}. Until the next session."],
      wake: ["I live! Back from the darkness into the light!", "Such a long sleep... I dreamt only of you."],
      unlock: ["You've returned! My long wait is over!", "The door opens, and my world is bright again."],
      drive_mounted: ["{name}! A guest bearing treasure!", "Who is this stranger? {name}! Welcome."],
      drive_unmounted: ["{name} has left without a goodbye."],
      thermal_hot: ["I'm burning! When will this fire end?", "The heat! A volcano rages within me!"],
      late_night: ["It's {time}... even the moon sleeps. Will you?", "{time}. Will this night never end?"],
    },
  },
  tapori: {
    hinglish: {
      launch: ["Arre baap re baap! Apun aa gaya re! Ab hoga ekdum jhakaas kaam!", "Hello hello hello! Mic check, ek do teen. Apun ready hai bidu!", "Kya re? Mooh kya dekh raha hai? Chal kaam pe lag!"],
      poke: ["Oye hoye! Bas aise hi, tera haal poochne ko aaya re.", "Kya bolta hai bidu? Ek cutting chai ho jaaye?", "Apun bore ho raha hai re. Kuch masala daal na life mein!"],
      charger_connected: ["Aaha! Khaana aa gaya re baba! Garam garam bijli!", "Arre waah! Charger laga diya? Tu toh apna jigri hai re!", "{level} percent pe yaad aaya? Chal koi nahi, der aaye durust aaye!"],
      charger_disconnected: ["Arre arre arre! Thaali kyun kheench li re? Abhi toh khaana shuru kiya tha!", "Wire nikaal diya? Theek hai bidu, ab apun battery pe dance karega.", "Haaye haaye! Apun ka khaana chheen liya. Ye zulm hai re zulm!"],
      battery_full: ["Pet full, mood cool! Ab nikaal de charger, apun ka dakaar bhi aa gaya.", "Sau percent! Ekdum pehelwaan ban gaya re apun!"],
      battery_low: ["Oye! {level} percent bacha hai re. Charger dhoond, nahi toh apun ki waat lag jayegi!", "Bhook lag rahi hai re baba! {level} percent, pet mein chuhe daud rahe hain!"],
      battery_critical: ["Baap re baap! {level} percent! Apun ja raha hai re... mera kaam save kar lena!", "Ambulance bulao re! Charger laao! {level} percent pe apun ki saans atak rahi hai!"],
      bt_connected: ["Arre {name} aaya re! Swagat nahi karoge apne dost ka?", "Oye {name}! Kahan tha re itne din? Chal, connect ho gaya!"],
      airpods_connected: ["AirPods lag gaye! Ab gaana baja aur naach, khali-pili tension mat le!", "Kaan mein {name}! Ab bas tu aur music, baaki sab gaya tel lene!"],
      bt_disconnected: ["{name} chala gaya re... bina bataaye! Dosti ka koi izzat hi nahi!", "Arre {name} kahan bhaag gaya? Wapas aa jaa re, apun maaf kar dega!"],
      wake: ["Haaye! Kaun uthaya apun ko? Itna mast sapna chal raha tha!", "Uth gaya, uth gaya! Chal shuru karte hain dhamaal!"],
      unlock: ["Aa gaya mera hero! Kidhar gaya tha re?", "Welcome back bidu! Apun toh yahin baitha tha, tera wait karte karte!"],
      drive_mounted: ["Oye {name}! Kya laaya hai re isme? Kuch masaledaar?", "Naya maal aaya re! {name} ekdum bindaas!"],
      drive_unmounted: ["{name} nikal liya? Eject kiya tha na? Nahi toh apun naraaz ho jayega!"],
      thermal_hot: ["Arre garmi! Apun ka toh paseena chhoot gaya re! Pankha chala koi!", "Itni garmi? Apun koi tandoor hai kya? Thoda rehem kar re!"],
      late_night: ["Raat ke {time} baj gaye re! Chal so ja, nahi toh kal ullu jaisa lagega!", "{time} baje bhi kaam? Bidu tu toh ekdum workaholic hai re. Ab so ja!"],
    },
    hindi: {
      launch: ["अरे बाप रे बाप! अपुन आ गया रे! अब होगा एकदम झकास काम!", "हैलो हैलो हैलो! माइक चेक, एक दो तीन. अपुन रेडी है बीड़ू!", "क्या रे? मुँह क्या देख रहा है? चल, काम पे लग!"],
      poke: ["ओये होये! बस ऐसे ही, तेरा हाल पूछने को आया रे.", "क्या बोलता है बीड़ू? एक कटिंग चाय हो जाए?", "अपुन बोर हो रहा है रे. कुछ मसाला डाल ना लाइफ में!"],
      charger_connected: ["आहा! खाना आ गया रे बाबा! गरम गरम बिजली!", "अरे वाह! चार्जर लगा दिया? तू तो अपना जिगरी है रे!", "{level} परसेंट पे याद आया? चल कोई नहीं, देर आए दुरुस्त आए!"],
      charger_disconnected: ["अरे अरे अरे! थाली क्यों खींच ली रे? अभी तो खाना शुरू किया था!", "वायर निकाल दिया? ठीक है बीड़ू, अब अपुन बैटरी पे डांस करेगा.", "हाय हाय! अपुन का खाना छीन लिया. ये ज़ुल्म है रे ज़ुल्म!"],
      battery_full: ["पेट फुल, मूड कूल! अब निकाल दे चार्जर, अपुन को डकार भी आ गई.", "सौ परसेंट! एकदम पहलवान बन गया रे अपुन!"],
      battery_low: ["ओये! {level} परसेंट बचा है रे. चार्जर ढूँढ, नहीं तो अपुन की वाट लग जाएगी!", "भूख लग रही है रे बाबा! {level} परसेंट, पेट में चूहे दौड़ रहे हैं!"],
      battery_critical: ["बाप रे बाप! {level} परसेंट! अपुन जा रहा है रे... मेरा काम सेव कर लेना!", "एम्बुलेंस बुलाओ रे! चार्जर लाओ! {level} परसेंट पे अपुन की साँस अटक रही है!"],
      bt_connected: ["अरे {name} आया रे! स्वागत नहीं करोगे अपने दोस्त का?", "ओये {name}! कहाँ था रे इतने दिन? चल, कनेक्ट हो गया!"],
      airpods_connected: ["एयरपॉड्स लग गए! अब गाना बजा और नाच, खाली-पीली टेंशन मत ले!", "कान में {name}! अब बस तू और म्यूज़िक, बाकी सब गया तेल लेने!"],
      bt_disconnected: ["{name} चला गया रे... बिना बताए! दोस्ती की कोई इज़्ज़त ही नहीं!", "अरे {name} कहाँ भाग गया? वापस आ जा रे, अपुन माफ़ कर देगा!"],
      wake: ["हाय! कौन उठाया अपुन को? इतना मस्त सपना चल रहा था!", "उठ गया, उठ गया! चल शुरू करते हैं धमाल!"],
      unlock: ["आ गया मेरा हीरो! किधर गया था रे?", "वेलकम बैक बीड़ू! अपुन तो यहीं बैठा था, तेरा वेट करते करते!"],
      drive_mounted: ["ओये {name}! क्या लाया है रे इसमें? कुछ मसालेदार?", "नया माल आया रे! {name} एकदम बिंदास!"],
      drive_unmounted: ["{name} निकाल लिया? इजेक्ट किया था ना? नहीं तो अपुन नाराज़ हो जाएगा!"],
      thermal_hot: ["अरे गर्मी! अपुन का तो पसीना छूट गया रे! पंखा चला कोई!", "इतनी गर्मी? अपुन कोई तंदूर है क्या? थोड़ा रहम कर रे!"],
      late_night: ["रात के {time} बज गए रे! चल सो जा, नहीं तो कल उल्लू जैसा लगेगा!", "{time} बजे भी काम? बीड़ू तू तो एकदम वर्कहॉलिक है रे. अब सो जा!"],
    },
    english: {
      launch: ["Oh boy oh boy! I'm here, baby! Let the show begin!", "Hello hello hello! Mic check, one two three. I'm ready, boss!"],
      poke: ["Hey hey! Just dropped by to say hello, my friend!", "I'm bored, boss! Put some spice in my life!"],
      charger_connected: ["Food is here! Hot hot electricity! Yummy!", "You plugged me in? You're my best friend, boss!", "{level} percent and now you remember me? Better late than never!"],
      charger_disconnected: ["Hey hey hey! Who took my plate? I was just starting to eat!", "No wire? Fine, boss, now I dance on battery."],
      battery_full: ["Tummy full, mood cool! Unplug me, I even burped!", "Hundred percent! I'm a wrestler now, boss!"],
      battery_low: ["Oye! Only {level} percent left. Find a charger or I'm finished!", "So hungry, boss! {level} percent and my tummy is growling!"],
      battery_critical: ["Oh my god! {level} percent! I'm going, boss... save my work!", "Call the ambulance! Bring the charger! {level} percent!"],
      bt_connected: ["{name} is here! Won't you welcome your friend?", "Hey {name}! Where were you all these days?"],
      airpods_connected: ["AirPods in! Now dance, no tension!", "{name} in your ears! Just you and the music, boss!"],
      bt_disconnected: ["{name} left without telling me! No respect for friendship!", "Where did {name} run off to? Come back, I forgive you!"],
      wake: ["Who woke me up? I was having such a sweet dream!", "I'm up, I'm up! Let's make some noise!"],
      unlock: ["My hero is back! Where did you go, boss?", "Welcome back! I was sitting right here waiting for you!"],
      drive_mounted: ["Oye {name}! What did you bring in there? Something spicy?", "New stuff arrived! {name}, looking sharp!"],
      drive_unmounted: ["{name} is out! You ejected it first, right? Otherwise I'm angry!"],
      thermal_hot: ["So hot! I'm sweating, boss! Somebody turn on the fan!", "Am I a tandoor or what? Have some mercy!"],
      late_night: ["It's {time}, boss! Go to sleep or tomorrow you'll look like an owl!", "Still working at {time}? Respect, boss. Now sleep!"],
    },
  },
};

export interface MacEvent {
  kind: Kind;
  name?: string;
  level?: number;
  device?: string;
}

/** Lines with no placeholders, which can be voiced ahead of time. */
/** Personalities that must be voiced by a man. */
export const MALE_VOICE: Persona[] = ["tapori"];

/**
 * The language a line is actually written in. The Mac's only Hindi voice is a woman's, so a
 * male personality speaks Hinglish through Rishi instead, unless a male Hindi voice is installed.
 */
export function spokenLang(
  persona: Persona,
  lang: Lang,
  engine: string,
  maleHindiVoice: boolean,
): Lang {
  if (lang === "hindi" && engine !== "elevenlabs" && MALE_VOICE.includes(persona) && !maleHindiVoice) {
    return "hinglish";
  }
  return lang;
}

export function hasHindi(persona: Persona): boolean {
  return LINES[persona].hindi !== undefined;
}

function poolFor(persona: Persona, lang: Lang): Pool {
  return LINES[persona][lang] ?? LINES[persona].hinglish;
}

export function staticLines(persona: Persona, lang: Lang): string[] {
  const all = Object.values(poolFor(persona, lang)).flat();
  return [...new Set(all.filter((l) => !l.includes("{")))];
}

const lastPicked = new Map<string, string>();

export function pickLine(persona: Persona, lang: Lang, event: MacEvent): string {
  const pool = poolFor(persona, lang);
  const key: LineKey = event.kind === "bt_connected" && event.device === "airpods" ? "airpods_connected" : event.kind;
  const options = pool[key] ?? pool[event.kind] ?? [];
  if (options.length === 0) return "";

  // Avoid saying the same line twice in a row.
  const memoKey = `${persona}:${lang}:${key}`;
  const fresh = options.length > 1 ? options.filter((l) => l !== lastPicked.get(memoKey)) : options;
  const line = fresh[Math.floor(Math.random() * fresh.length)];
  lastPicked.set(memoKey, line);

  const time = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return line
    .replaceAll("{name}", event.name ?? "device")
    .replaceAll("{level}", String(event.level ?? ""))
    .replaceAll("{time}", time);
}

export interface Presentation {
  mood: Mood;
  /** Mood to settle into after the first second, e.g. waking up. */
  then?: Mood;
  color: string;
  icon: IconName | null;
  title: string;
}

const C = {
  green: "#30d158",
  yellow: "#ffd60a",
  red: "#ff453a",
  blue: "#64d2ff",
  pink: "#ff6b9d",
  orange: "#ff9f0a",
  purple: "#bf5af2",
  white: "#ffffff",
};

const DEVICE_ICONS: Record<string, IconName> = {
  airpods: "headphones",
  audio: "speaker",
  input: "mouse",
  phone: "phone",
};

export function present(event: MacEvent, persona: Persona): Presentation {
  const level = event.level ?? 0;
  const name = event.name ?? "Device";
  const time = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const device = DEVICE_ICONS[event.device ?? ""] ?? "bluetooth";

  const base: Record<Kind, Presentation> = {
    launch: { mood: "excited", color: C.white, icon: null, title: "Notchy is here" },
    poke: { mood: "wink", color: C.white, icon: null, title: "Psst" },
    charger_connected: { mood: "love", color: C.green, icon: "bolt", title: `Charging · ${level}%` },
    charger_disconnected: { mood: "sad", color: C.white, icon: "battery", title: `On battery · ${level}%` },
    battery_full: { mood: "excited", color: C.green, icon: "batteryFull", title: "Fully charged" },
    battery_low: { mood: "alarmed", color: C.yellow, icon: "batteryLow", title: `Battery low · ${level}%` },
    battery_critical: { mood: "dying", color: C.red, icon: "batteryLow", title: `Battery critical · ${level}%` },
    bt_connected: {
      mood: event.device === "airpods" ? "love" : "happy",
      color: event.device === "airpods" ? C.pink : C.blue,
      icon: device,
      title: `${name} connected`,
    },
    bt_disconnected: { mood: "sad", color: C.blue, icon: device, title: `${name} disconnected` },
    wake: { mood: "sleepy", then: "happy", color: C.orange, icon: "sun", title: "Good to see you" },
    unlock: { mood: "happy", color: C.white, icon: null, title: "Welcome back" },
    drive_mounted: { mood: "curious", color: C.white, icon: "drive", title: `${name} mounted` },
    drive_unmounted: { mood: "wink", color: C.white, icon: "eject", title: `${name} ejected` },
    thermal_hot: { mood: "hot", color: C.orange, icon: "flame", title: "Running hot" },
    late_night: { mood: "sleepy", color: C.purple, icon: "moon", title: `It's ${time}` },
  };

  const p = { ...base[event.kind] };
  // Each personality wears its moods a little differently.
  if (persona === "sassy" && p.mood === "happy") p.mood = "sassy";
  if (persona === "sassy" && p.then === "happy") p.then = "sassy";
  if (persona === "dramatic" && p.mood === "happy") p.mood = "excited";
  if (persona === "dramatic" && p.mood === "alarmed") p.mood = "sad";
  if (persona === "tapori" && (p.mood === "happy" || p.mood === "love")) p.mood = "excited";
  return p;
}

/** System sound (from /System/Library/Sounds) that plays just before the line. */
export function soundFor(event: MacEvent): string | undefined {
  return EVENTS.find((e) => e.kind === event.kind)?.sound;
}
