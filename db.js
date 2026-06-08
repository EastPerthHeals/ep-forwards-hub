const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.MONGO_DB_NAME || 'ep_forwards_hub';

let client;
let db;

async function connect() {
  if (db) return db;
  if (!MONGO_URI) throw new Error('MONGO_URI environment variable is not set');
  client = new MongoClient(MONGO_URI);
  await client.connect();
  db = client.db(DB_NAME);

  // seed if empty (first-ever run)
  const roundsCount = await db.collection('rounds').countDocuments();
  if (roundsCount === 0) {
    await db.collection('rounds').insertMany(SEED.rounds);
  }
  const reviewsCount = await db.collection('reviews').countDocuments();
  if (reviewsCount === 0) {
    await db.collection('reviews').insertMany(SEED.reviews);
  }
  return db;
}

const SEED = {
  rounds: [
    {round_num:1,label:'Rd 1 · Subiaco',short:'Rd 1',opponent:'Subiaco',wl:'L',force_q1:242,force_q2:224,force_q3:229,force_q4:200,force_avg:224,i50:12,pct_scores_i50:52.5,pct_accuracy:71.75,pct_tackles_i50:21,pct_marks_i50:19.25,pct_oppo_r50:47.25,score_sources:[['Free Kick',2],['Front & Centre',2],['CBD (BM)',2],['Surge HBR',2],['Fwd Half Intercept',7],['F50 Stop',1],['Def Half Intercept',1]],intercept_fwds:5,intercept_backs:2,intercept_mids:1,learned:'Subi are proactive and defend front shoulder. Need to get them and play through!',work_on:'F50 stops when 2 opposition wingers are there'},
    {round_num:2,label:'Rd 2 · Swan Districts',short:'Rd 2',opponent:'Swan Districts',wl:'W',force_q1:154,force_q2:181,force_q3:225,force_q4:234,force_avg:199,i50:11,pct_scores_i50:60,pct_accuracy:46,pct_tackles_i50:23,pct_marks_i50:32,pct_oppo_r50:27,score_sources:[['Free Kick',1],['Front & Centre',1],['Ball Movement',5],['Fwd Half Intercept',4],['F50 Stop',2]],intercept_fwds:1,intercept_backs:2,intercept_mids:1,learned:'Swans flips hurt us defensively. Value defence!',work_on:'Wing and half-forward flips. Jonesy forward.'},
    {round_num:3,label:'Rd 3 · East Fremantle',short:'Rd 3',opponent:'East Fremantle',wl:'L',force_q1:171,force_q2:219,force_q3:160,force_q4:156,force_avg:177,i50:11,pct_scores_i50:44,pct_accuracy:52,pct_tackles_i50:32,pct_marks_i50:16,pct_oppo_r50:22,score_sources:[['Free Kick',1],['Front & Centre',1],['CBD (BM)',1],['Fwd Half Intercept',5],['Surge (Mark)',1]],intercept_fwds:3,intercept_backs:1,intercept_mids:1,learned:'Knight flips very effective. Last 10 of Q3 we got brained.',work_on:'Last kick inside 50.'},
    {round_num:4,label:'Rd 4 · Perth',short:'Rd 4',opponent:'Perth',wl:'W',force_q1:204,force_q2:129,force_q3:242,force_q4:254,force_avg:207,i50:8,pct_scores_i50:65,pct_accuracy:35,pct_tackles_i50:27,pct_marks_i50:49,pct_oppo_r50:24,score_sources:[],intercept_fwds:null,intercept_backs:null,intercept_mids:null,learned:'',work_on:''},
    {round_num:5,label:'Rd 5',short:'Rd 5',opponent:'',wl:'W',force_q1:null,force_q2:null,force_q3:null,force_q4:null,force_avg:214,i50:11,pct_scores_i50:61,pct_accuracy:59,pct_tackles_i50:13,pct_marks_i50:37,pct_oppo_r50:34,score_sources:[],intercept_fwds:null,intercept_backs:null,intercept_mids:null,learned:'',work_on:''},
    {round_num:6,label:'Rd 6',short:'Rd 6',opponent:'',wl:'L',force_q1:null,force_q2:null,force_q3:null,force_q4:null,force_avg:187,i50:12,pct_scores_i50:34,pct_accuracy:59,pct_tackles_i50:33,pct_marks_i50:15,pct_oppo_r50:34,score_sources:[],intercept_fwds:null,intercept_backs:null,intercept_mids:null,learned:'',work_on:''},
    {round_num:7,label:'Rd 7',short:'Rd 7',opponent:'',wl:'W',force_q1:null,force_q2:null,force_q3:null,force_q4:null,force_avg:174,i50:13,pct_scores_i50:44,pct_accuracy:45,pct_tackles_i50:24,pct_marks_i50:22,pct_oppo_r50:25,score_sources:[],intercept_fwds:null,intercept_backs:null,intercept_mids:null,learned:'',work_on:''},
    {round_num:8,label:'Rd 8',short:'Rd 8',opponent:'',wl:'L',force_q1:null,force_q2:null,force_q3:null,force_q4:null,force_avg:167,i50:11,pct_scores_i50:37,pct_accuracy:50,pct_tackles_i50:17,pct_marks_i50:30,pct_oppo_r50:22,score_sources:[],intercept_fwds:null,intercept_backs:null,intercept_mids:null,learned:'',work_on:''},
  ],
  reviews: [
    {player_name:'B. Middleton',round_num:1,round_label:'Rd 1',rating:'Average',comment:'Intensity was there, but ability to think through scenarios was a fraction slow. Patterns improving but communication has to lift. 5 CPs, 3 GBGs, 2 score assists, 4 score involvements. One tackle and one intercept — defensive impact not at level required. RFI: Improve communication and speed of decision making around structure and spare usage.'},
    {player_name:'B. Middleton',round_num:2,round_label:'Rd 2',rating:'Above Average',comment:'Very solid performance. Physicality and craft both up forward and in the ruck was evident. 6 CPs, 4 GBGs, 2 intercepts. A goal, score assist, 6 score involvements. RFI: Keep building patterns and communication while maintaining physical presence and contest work.'},
    {player_name:'B. Middleton',round_num:3,round_label:'Rd 3',rating:'Above Average',comment:'Strong performance despite numbers not jumping off the page. Defensively excellent — 4 tackles, 6 CPs, 4 GBGs, 3 intercepts. Two goals, score assist, 4 score involvements. RFI: Keep refining structure while maintaining contest and defensive intent.'},
    {player_name:'B. Middleton',round_num:4,round_label:'Rd 4',rating:'Above Average',comment:'Work rate was elite, Q4 a real standout. 5 CPs, 4 tackles, 4 intercepts — excellent defensive reading. 7 score involvements, 5 inside 50s. 6 turnovers is too high. RFI: Clean up ball use and reduce turnovers while maintaining elite work rate.'},
    {player_name:'S. van Diemen',round_num:1,round_label:'Rd 1',rating:'Excellent',comment:'Very strong performance. Sharp below the knees, excellent craft in tight. 8 CPs and 7 GBGs. Game high 9 score involvements, 4 score assists and a goal. 5 inside 50s and 11 HBRs. RFI: Tighten structural stuff around stoppage and spare usage.'},
    {player_name:'S. van Diemen',round_num:2,round_label:'Rd 2',rating:'Excellent',comment:'Offensive numbers lower but influence went beyond stats. The Knight role in Q2 was really important. 3 tackles, 6 HBRs, continued movement and pressure. RFI: Intercept game — will get more offensive chances.'},
    {player_name:'S. van Diemen',round_num:3,round_label:'Rd 3',rating:'Excellent',comment:'No review recorded this round.'},
    {player_name:'S. van Diemen',round_num:4,round_label:'Rd 4',rating:'Excellent',comment:'5 CPs, 2 intercepts, intent to stay involved evident. A goal, score assist and 5 score involvements. RFI: Sharpen decision making with ball movement and be more proactive breaking seam.'},
    {player_name:'T. Graham',round_num:1,round_label:'Rd 1',rating:'Above Average',comment:'Strong performance. 6 CPs and 4 GBGs. 5 goals and 8 score involvements — outstanding output. Reaction to engage on a lead still too slow. RFI: Craft through opposition, keep exploring ways to create separation.'},
    {player_name:'T. Graham',round_num:2,round_label:'Rd 2',rating:'Above Average',comment:'Effort all day was excellent. Second and third efforts a real feature. Defensive solid with good intent. RFI: Continue to sharpen craft on opponent at training.'},
    {player_name:'S. Kuek',round_num:1,round_label:'Rd 1',rating:'Average',comment:"Excellent offensive performance — 3 goals, 7 score involvements, score assist. 4 inside 50s. 5 CPs, 3 GBGs and 3 tackles — clear defensive improvement from last year. RFI: Keep lifting defensive work rate, don't play near other talls."},
    {player_name:'S. Kuek',round_num:2,round_label:'Rd 2',rating:'Average',comment:'Outstanding performance even without any tackles! Got an intercept and execution by foot was excellent. 5 inside 50s game high. 2 goals, 2 score assists and 5 score involvements. RFI: Keep building defensive work rate.'},
    {player_name:'S. Kuek',round_num:3,round_label:'Rd 3',rating:'Average',comment:'Low disposal game. Direct opponent running off you and reaction speed too slow early. Still a goal, score assist and 2 intercepts. RFI: Back marking ability and attack the ball with confidence.'},
    {player_name:'S. Kuek',round_num:4,round_label:'Rd 4',rating:'Average',comment:'Patterns improving but more work to do. Only 1 tackle and no intercepts — yet to see four-quarter defensive intent. RFI: Lift defensive intent across four quarters.'},
    {player_name:'D. Craven',round_num:1,round_label:'Rd 1',rating:'Above Average',comment:'Reading cues too early — need to stay engaged at contest until we truly win it. Step out of traffic is clearly a weapon but happening too high (0 inside 50s). 3 goals, 6 score involvements, 4 intercepts, 4 tackles. RFI: Remain connected at contest then drive forward and deliver inside 50.'},
    {player_name:'D. Craven',round_num:2,round_label:'Rd 2',rating:'Above Average',comment:'Sound performance. High speed running a real feature. 3 goals, 8 score involvements, score assist — elite output. 8 CPs, 5 GBGs and 5 tackles. No intercepts is the clear area to lift. RFI: Turn defensive pressure into intercepts.'},
    {player_name:'D. Craven',round_num:3,round_label:'Rd 3',rating:'Below Average',comment:'Slow day. Lack of defensive impact noticeable — only 1 tackle and no intercepts. 4 CPs and 2 GBGs. Modest numbers across the board offensively. RFI: Lift defensive impact to create more offensive opportunity.'},
    {player_name:'D. Craven',round_num:4,round_label:'Rd 4',rating:'Below Average',comment:'Another slow day, struggled to find rhythm. 5 CPs and 4 GBGs, 1 inside 50 suggests involvement too high. 1 goal, 5 score involvements, game high 3 score assists. Only 2 tackles and no intercepts. RFI: Lift defensive intent and pressure.'},
    {player_name:'C. Burgiel',round_num:1,round_label:'Rd 1',rating:'Below Average',comment:'Step in the right direction defensively. Still no intercepts. 5 CPs and 5 GBGs. 7 score involvements, 2 score assists and 2 goals in the second half. RFI: Keep building defensive side, particularly generating intercepts.'},
    {player_name:'C. Burgiel',round_num:2,round_label:'Rd 2',rating:'Above Average',comment:'Much more well-rounded performance. 7 CPs, 4 GBGs, 2 intercepts. 2 score assists and 4 score involvements. RFI: Keep building on contest and defensive output.'},
    {player_name:'C. Burgiel',round_num:3,round_label:'Rd 3',rating:'Above Average',comment:'Good day overall. 7 CPs and 6 GBGs. Very proud of the 4 intercepts — real indicator of growth. Over-handballed at times when legs and ground was the better option. RFI: Trust legs more with ball in hand.'},
    {player_name:'C. Burgiel',round_num:4,round_label:'Rd 4',rating:'Well Below Average',comment:'Minimal overall impact. Zero CPs, zero GBGs and zero intercepts is well below standard. Contest-to-contest work rate looked slow. 3 tackles but without contest wins or intercepts it only gets the job halfway done. RFI: Significantly lift work rate and contest intent.'},
    {player_name:'M. Schofield',round_num:2,round_label:'Rd 2',rating:'Excellent',comment:'Outstanding return to League team. 9 score involvements, 4 goals and a score assist — elite output. 4 inside 50s, smother on defence shows intent was there.'},
    {player_name:'M. Schofield',round_num:3,round_label:'Rd 3',rating:'Below Average',comment:'Some strong aspects but defensive standard needs addressing immediately. Zero tackles and intercepts is unacceptable. 6 CPs and 3 GBGs, 5 score involvements game high. Accuracy hurt you. RFI: Lift defensive output, particularly tackling, while sharpening finishing.'},
    {player_name:'M. Schofield',round_num:4,round_label:'Rd 4',rating:'Below Average',comment:'Work rate evident in ball movement and patterns. But too many moments caught ball watching. Zero tackles, 1 CP and 1 GBG, no intercepts — a clear ongoing pattern. RFI: Take ownership of defensive impact when ball movement is not going your way.'},
    {player_name:'B. Delaney',round_num:3,round_label:'Rd 3',rating:'Above Average',comment:'Ability to find the ball on outside evident — 5 inside 50s excellent. 3 intercepts shows good reading. 2 goals. 5 turnovers will improve with exposure to League pace. Contest was poor — zero tackles is not acceptable. RFI: Come find me Tue/Thu with a bump bag!'},
    {player_name:'D. Freitag',round_num:1,round_label:'Rd 1',rating:'Below Average',comment:'Not a great performance overall. Fwd/ruck role is tough but impact is required. Off-ball patterns passive and out of position limiting aerial presence. 3 CPs and 2 GBGs. Only one tackle and no inside 50s. RFI: Sharpen patterns and engage up the ground to the wings and outlet.'},
    {player_name:'T. Lindberg',round_num:1,round_label:'Rd 1',rating:'Average',comment:'In and out but exciting when taking the game on! 4 CPs and 3 GBGs, 6 HBRs and 6 score involvements, 2 score assists. 3 inside 50s. Only 2 tackles and 1 intercept defensively. RFI: Lift defensive intensity while maintaining run and carry.'},
    {player_name:'T. Lindberg',round_num:4,round_label:'Rd 4',rating:'Average',comment:'Good moments throughout. 2 goals. Defensively average — 1 tackle, 1 CP, 1 GBG. 5 score involvements and 3 inside 50s. RFI: Lift contest work and defensive pressure while backing yourself in front of goal.'},
    {player_name:'W. Cassidy',round_num:2,round_label:'Rd 2',rating:'Average',comment:'Impactful in bursts, will be better for the run. Game high 3 score assists shows great awareness. Contest the main area to lift — only 1 GBG and 2 CPs. RFI: Make more contests, win more ground balls in 2v2 and 3v3.'},
    {player_name:'W. Cassidy',round_num:3,round_label:'Rd 3',rating:'Average',comment:'Another step in the right direction, disciplined in role. Sloppy moments with ball in hand felt like indecisiveness. 4 CPs, 3 GBGs and 2 intercepts. RFI: Be more decisive with ball in hand, back yourself to drive and take ground.'},
    {player_name:'W. Cassidy',round_num:4,round_label:'Rd 4',rating:'Above Average',comment:'Offensive output very solid — game high goals, strong score involvements and score assists. 7 score involvements from limited opportunity. 1 tackle and no intercepts below standard. RFI: Lift defensive impact, get tackle and intercept numbers up.'},
  ]
};

async function load() {
  const database = await connect();
  const rounds = await database.collection('rounds').find({}, { projection: { _id: 0 } }).toArray();
  const reviews = await database.collection('reviews').find({}, { projection: { _id: 0 } }).toArray();
  return { rounds, reviews };
}

async function save(data) {
  const database = await connect();
  await database.collection('rounds').deleteMany({});
  if (data.rounds && data.rounds.length) {
    await database.collection('rounds').insertMany(data.rounds.map(r => ({ ...r })));
  }
  await database.collection('reviews').deleteMany({});
  if (data.reviews && data.reviews.length) {
    await database.collection('reviews').insertMany(data.reviews.map(r => ({ ...r })));
  }
}

module.exports = { load, save };
