# Composition Drafts

release / live の Markdown に登場する曲名候補を、機械的に正規化してまとめたレビュー用下書きです。

- release occurrences: 330
- live occurrences: 2993
- draft files: 523

## Review Workflow

1. `sources` が多いファイルから確認する。
2. `canonical_title` を正式な曲名に直す。
3. 同一曲の表記ゆれを `aliases` に残す。
4. 別曲が混ざっていたら、該当 source を別の draft md に分割する。
5. 他の draft と同一曲だったら、片方に `sources` / `aliases` を寄せて、不要側は `status: merged` にする。
6. DB に入れてよい状態になったら `status: reviewed` にする。

Review UI の merge 操作を使うと、current draft の `sources` / `aliases` が target draft に追加され、current draft は `status: merged` になります。

## Status

| status | meaning |
| --- | --- |
| `draft` | 自動生成直後。未確認。 |
| `reviewed` | 人間確認済み。DB 生成対象。 |
| `merged` | 他の draft に統合済み。DB 生成対象外。 |
| `split` | 別 draft に分割済み。DB 生成対象外。 |
| `ignore` | 曲として扱わない。DB 生成対象外。 |

## Review Rules

- `canonical_title` は1曲に1つだけの代表表記にする。
- `aliases` は表記ゆれだけを入れる。別バージョン名や演奏形態を同一曲として扱うかは人間が判断する。
- `sources` は出典なので、基本的には消さない。誤抽出だけ削除する。
- `composition_id` は未定なら `null` のままでよい。後続の SQL 生成時に決める。
- 判断に迷うものは `status: draft` のまま残す。

| sources | canonical title | file |
| ---: | --- | --- |
| 101 | (can you feel?)～Most beautiful in the world～ | `(can_you_feel_)～Most_beautiful_in_the_world～-4a1ec090.md` |
| 93 | ミナソコ | `ミナソコ-2cd41d50.md` |
| 74 | ユートピア | `ユートピア-fddac7d5.md` |
| 73 | Bit by bit | `Bit_by_bit-36fc9dae.md` |
| 67 | タネリ | `タネリ-df940b08.md` |
| 61 | Sweet heart of moon | `Sweet_heart_of_moon-22dd4902.md` |
| 58 | Analyze | `Analyze-6257f84c.md` |
| 58 | Apple star storyS | `Apple_star_storyS-8c4142ac.md` |
| 58 | 前夜祭 | `前夜祭-db8cca18.md` |
| 56 | Nightmare's Beginning | `Nightmare's_Beginning-0db59066.md` |
| 54 | キャンプファイヤーソング | `キャンプファイヤーソング-de061923.md` |
| 53 | AM4:00 | `AM4_00-f43b8270.md` |
| 52 | MARCH | `MARCH-5b6583d6.md` |
| 48 | そして列車は行く | `そして列車は行く-2f98bf47.md` |
| 47 | 微笑とメロディー | `微笑とメロディー-06b45a44.md` |
| 46 | 逆光 | `逆光-32bf3a92.md` |
| 45 | candle for minority | `candle_for_minority-759a4609.md` |
| 44 | エコー | `エコー-deb6d86b.md` |
| 42 | cold burn | `cold_burn-3780f98f.md` |
| 42 | Pretty little horses | `Pretty_little_horses-344fe199.md` |
| 41 | 息吹と共に混沌を裂いて | `息吹と共に混沌を裂いて-45782541.md` |
| 40 | ハウリングムーン | `ハウリングムーン-2e24b8fb.md` |
| 36 | BRAVE GIRL IN HELL | `BRAVE_GIRL_IN_HELL-2fb7cfc0.md` |
| 36 | Perfect nervous | `Perfect_nervous-043d2010.md` |
| 35 | ドーナツ | `ドーナツ-972da701.md` |
| 34 | 雨と仲良く | `雨と仲良く-9b3667d9.md` |
| 33 | Dear my teacher | `Dear_my_teacher-f5159fc3.md` |
| 32 | 指輪 | `指輪-24e0e193.md` |
| 31 | 自己暗示の日 | `自己暗示の日-cb1e2e3b.md` |
| 30 | 埋立地 | `埋立地-e9e5b7a7.md` |
| 30 | 独り言 | `独り言-f605bd87.md` |
| 29 | Lesson | `Lesson-b11449a3.md` |
| 28 | 光の粒子 埃の中で (Departures) | `光の粒子_埃の中で_(Departures)-bc418f05.md` |
| 27 | Blue moon shadow | `Blue_moon_shadow-fd62ef3c.md` |
| 23 | Twice birds' singing | `Twice_birds'_singing-7121408d.md` |
| 23 | 歪み | `歪み-66a480a6.md` |
| 23 | 鍛冶屋 花火師 ピエロ | `鍛冶屋_花火師_ピエロ-f29bb105.md` |
| 22 | あのキラキラした綺麗事を (AGAIN) | `あのキラキラした綺麗事を_(AGAIN)-92c32b8e.md` |
| 22 | 空気清浄機 | `空気清浄機-f34bcafa.md` |
| 22 | 調律するかのように (Over The Rainbow) | `調律するかのように_(Over_The_Rainbow)-392e8d5e.md` |
| 22 | 風の音符 歓喜の声 和音 | `風の音符_歓喜の声_和音-7cfc00ce.md` |
| 21 | 不感症 | `不感症-ee234080.md` |
| 20 | ♥のJUNKY | `♥のJUNKY-48603067.md` |
| 19 | Alice | `Alice-522b276a.md` |
| 18 | Groria Streetから愛を込めて #3 -嬉しくて哀しい事- | `Groria_Streetから愛を込めて_#3_-嬉しくて哀しい事--2d54a1f4.md` |
| 18 | 君と僕 (flowers) | `君と僕_(flowers)-f9e24e39.md` |
| 18 | 大行進 | `大行進-03e3ed32.md` |
| 18 | 誇りの響き 光の中へ (White White White) | `誇りの響き_光の中へ_(White_White_White)-f92e523e.md` |
| 18 | 黄金の鐘 | `黄金の鐘-0a99405f.md` |
| 16 | ANDANTINO -museの楽団- | `ANDANTINO_-museの楽団--54ff3af0.md` |
| 16 | Introduction | `Introduction-26aca794.md` |
| 16 | judgement; | `judgement;-08de8eb4.md` |
| 16 | もう、夢の無い夢の終わり (From Here to Eternity) | `もう、夢の無い夢の終わり_(From_Here_to_Eternity)-6309eb1b.md` |
| 16 | 何もかも越えて、吐き気がする (Down to heaven) | `何もかも越えて、吐き気がする_(Down_to_heaven)-575c6765.md` |
| 16 | 慰霊堂清掃奉仕 (Happy Birthday!) | `慰霊堂清掃奉仕_(Happy_Birthday!)-c91e7f64.md` |
| 16 | 神様ごっこ | `神様ごっこ-013f8961.md` |
| 16 | 陽だまりを越えて | `陽だまりを越えて-a1976b4b.md` |
| 15 | B D H M | `B_D_H_M-683eb1e3.md` |
| 15 | その自慰が終わったなら (Modern Ghost) | `その自慰が終わったなら_(Modern_Ghost)-8455d8a2.md` |
| 15 | プリンスとプリンセス (Nursery Rhymes ep4) | `プリンスとプリンセス_(Nursery_Rhymes_ep4)-4974b06e.md` |
| 15 | 後夜祭 | `後夜祭-6388a194.md` |
| 14 | I Love You | `I_Love_You-bb7b1901.md` |
| 14 | Natural Born Queen | `Natural_Born_Queen-8063d5d2.md` |
| 14 | trick or treat | `trick_or_treat-871df97a.md` |
| 14 | カナリア | `カナリア-2a48f361.md` |
| 14 | バネのいかれたベッドの上で (I Don't Wanna Grow Up) | `バネのいかれたベッドの上で_(I_Don't_Wanna_Grow_Up)-685cac4d.md` |
| 14 | 神の犬 (Do Justice To?) | `神の犬_(Do_Justice_To_)-99826f99.md` |
| 14 | 窮屈、退屈、卑屈 (A-halo) | `窮屈、退屈、卑屈_(A-halo)-d8520c8c.md` |
| 14 | 草の花 | `草の花-f43fde90.md` |
| 13 | fructose | `fructose-2cdb8961.md` |
| 13 | Normal Abnormal | `Normal_Abnormal-90b8a3c5.md` |
| 13 | 倖 | `倖-d846c6fc.md` |
| 13 | 冷たい水 | `冷たい水-1bd8014d.md` |
| 13 | 遺失物取り扱い係り | `遺失物取り扱い係り-e2809b3e.md` |
| 13 | 酸素 | `酸素-5d41163f.md` |
| 12 | All Bet | `All_Bet-4cdfcf1e.md` |
| 12 | hostia | `hostia-f9246a64.md` |
| 12 | 双子座のミステリー、孤児のシンパシー (GPS) | `双子座のミステリー、孤児のシンパシー_(GPS)-8c14ea99.md` |
| 12 | 吐息達の棲み家 | `吐息達の棲み家-a69ebcfb.md` |
| 12 | 絶滅危惧種のペンギンたちが可哀想 | `絶滅危惧種のペンギンたちが可哀想-3d5f0c20.md` |
| 11 | Music From Twilight | `Music_From_Twilight-9cd68a97.md` |
| 11 | Song for lover's | `Song_for_lover's-b1fdceb8.md` |
| 11 | ミナソコ (acoustic version) | `ミナソコ_(acoustic_version)-7b3eb8d8.md` |
| 11 | 今、万感の想いを込めて | `今、万感の想いを込めて-f0a9e249.md` |
| 11 | 唱えよ、春 静か (XIII) | `唱えよ、春_静か_(XIII)-ff2a4d7d.md` |
| 11 | 永遠に柔らかな罰を (Cheek-to-cheek Dancing for Broken hearts) | `永遠に柔らかな罰を_(Cheek-to-cheek_Dancing_for_Broken_hearts)-bb96b866.md` |
| 10 | NERD | `NERD-3c62e330.md` |
| 10 | singing in the rain | `singing_in_the_rain-25637b92.md` |
| 10 | 林檎 | `林檎-97443afa.md` |
| 10 | 言葉と心 | `言葉と心-55dacea7.md` |
| 9 | Methods Of Dance | `Methods_Of_Dance-8383fda1.md` |
| 9 | MoYuRu | `MoYuRu-32c544cc.md` |
| 9 | この生温くうっとおしい心を | `この生温くうっとおしい心を-b1c9b4bb.md` |
| 9 | ハイ・ストレンジネス | `ハイ・ストレンジネス-9bc6370c.md` |
| 9 | 救えない。心から。 (V.I.C.T.O.R.Y.) | `救えない。心から。_(V.I.C.T.O.R.Y.)-31c28eb7.md` |
| 9 | 火の凛 | `火の凛-31f005de.md` |
| 9 | 長い序章の終わり (Law Name) | `長い序章の終わり_(Law_Name)-6396936f.md` |
| 8 | POPCORN | `POPCORN-9299b2a6.md` |
| 8 | ダイヤモンドは傷つかない (In Memory Of Louis) | `ダイヤモンドは傷つかない_(In_Memory_Of_Louis)-690a3277.md` |
| 8 | 感想文 | `感想文-d7d1b92f.md` |
| 8 | 楽園の追放者 (Somebody To Love) | `楽園の追放者_(Somebody_To_Love)-96df6842.md` |
| 8 | 氷の皿 (Ave Maria) | `氷の皿_(Ave_Maria)-99a17fcd.md` |
| 8 | 自由も孤独もいらなくなって | `自由も孤独もいらなくなって-6f9c4e85.md` |
| 7 | boys in blue | `boys_in_blue-5f58349b.md` |
| 7 | パスタ | `パスタ-220d1780.md` |
| 7 | 儚いことしたい病 | `儚いことしたい病-db6c89e8.md` |
| 7 | 廃墟の子供達 -黒い羊水- | `廃墟の子供達_-黒い羊水--82c1bd81.md` |
| 7 | 鋼鉄の朝 | `鋼鉄の朝-9107e4c1.md` |
| 6 | 「ただいま」と「おやすみ」の間に (Nursery Rhymes ep1) | `「ただいま」と「おやすみ」の間に_(Nursery_Rhymes_ep1)-a6acbaf1.md` |
| 6 | Groria Streetから愛を込めて #1 | `Groria_Streetから愛を込めて_#1-d239cddf.md` |
| 6 | Introduction -D&D鉄道 車内アナウンス- | `Introduction_-D&D鉄道_車内アナウンス--4bdef1e7.md` |
| 6 | だが、ワインは赫 (Deep Red Wine) | `だが、ワインは赫_(Deep_Red_Wine)-6c31e03d.md` |
| 6 | ただ美しく (Grace) | `ただ美しく_(Grace)-32d2c82b.md` |
| 6 | バネのイカれたベッドの上 (I Don't Wanna Grow Up) | `バネのイカれたベッドの上_(I_Don't_Wanna_Grow_Up)-176bec0b.md` |
| 6 | 他 | `他-e31b569a.md` |
| 6 | 観た事のないものを、好きなだけ (THE LAND OF DO-AS-YOU-PLEASE) | `観た事のないものを、好きなだけ_(THE_LAND_OF_DO-AS-YOU-PLEASE)-77873afe.md` |
| 5 | Born Again | `Born_Again-983e8637.md` |
| 5 | The Winner | `The_Winner-25ee5283.md` |
| 5 | ゴスペル | `ゴスペル-916ea926.md` |
| 5 | コミュニティー | `コミュニティー-b3c13467.md` |
| 5 | サラダバー | `サラダバー-828f4a99.md` |
| 5 | サンビカ | `サンビカ-21b326fd.md` |
| 5 | ネギ | `ネギ-412450f5.md` |
| 5 | フラウ (自己暗示の日) | `フラウ_(自己暗示の日)-3330af57.md` |
| 5 | もう、夢の無い夢の終わり(From Here to Eternity) | `もう、夢の無い夢の終わり(From_Here_to_Eternity)-a1b22e41.md` |
| 5 | 主よ、人の望みを喜びよ (Guitar insturmental) | `主よ、人の望みを喜びよ_(Guitar_insturmental)-f046f1aa.md` |
| 5 | 何もかも越えて、吐き気がする (Down To Heaven) [Lost Verse(s) ver.] | `何もかも越えて、吐き気がする_(Down_To_Heaven)_[Lost_Verse(s)_ver.]-8cee673b.md` |
| 5 | 勇敢な指揮者～大行進 | `勇敢な指揮者～大行進-83b3b295.md` |
| 5 | 微笑とメロディ | `微笑とメロディ-7594b638.md` |
| 5 | 性器を無くしたアンドロイド (Dystopia) | `性器を無くしたアンドロイド_(Dystopia)-ae00cce9.md` |
| 5 | 接続されたままで (I can not Dance) | `接続されたままで_(I_can_not_Dance)-4ddc393e.md` |
| 5 | 暗証番号 | `暗証番号-bb523142.md` |
| 5 | 痛いな、この光 (Ticket To Nowhere) | `痛いな、この光_(Ticket_To_Nowhere)-13b33ace.md` |
| 5 | 祈り (It's show time) | `祈り_(It's_show_time)-dd27f941.md` |
| 5 | 窮屈な退屈で卑屈な天使 (Stiff, Tedium, Obsequious) | `窮屈な退屈で卑屈な天使_(Stiff,_Tedium,_Obsequious)-96dfc7f6.md` |
| 4 | 〜Welcome to the nightmare〜 | `〜Welcome_to_the_nightmare〜-2ea1f3e9.md` |
| 4 | (can you feel?) ～Most beautful in the world～ | `(can_you_feel_)_～Most_beautful_in_the_world～-1c3cf34a.md` |
| 4 | (con)crete | `(con)crete-2b6e187c.md` |
| 4 | Beautiful Loser | `Beautiful_Loser-da38bb1b.md` |
| 4 | just my pain | `just_my_pain-d0391eb0.md` |
| 4 | Kireigoto ("あのキラキラした綺麗事を (AGAIN)" rearrange) | `Kireigoto_(_あのキラキラした綺麗事を_(AGAIN)__rearrange)-ca2bf22c.md` |
| 4 | The Beautiful Soldier | `The_Beautiful_Soldier-9cb46749.md` |
| 4 | ある日、街灯の下 (Farewell, My Lovely) | `ある日、街灯の下_(Farewell,_My_Lovely)-4c90003e.md` |
| 4 | イプシロンは泣いてたよ (A Boy In The Avenge) | `イプシロンは泣いてたよ_(A_Boy_In_The_Avenge)-e2cd3c34.md` |
| 4 | オベリスク | `オベリスク-799e435f.md` |
| 4 | カナリア (Live version) | `カナリア_(Live_version)-163a6ef5.md` |
| 4 | ないよなにも | `ないよなにも-0ebf34b1.md` |
| 4 | 二匹の猫の為のエチュード | `二匹の猫の為のエチュード-e36166e9.md` |
| 4 | 光の粒子 埃の中で (Departures) [Lost Verse(s) ver.] | `光の粒子_埃の中で_(Departures)_[Lost_Verse(s)_ver.]-cf615874.md` |
| 4 | 救えない。心から。 (V.I.C.T.O.R.Y) | `救えない。心から。_(V.I.C.T.O.R.Y)-c9688601.md` |
| 4 | 瞳は野性、星はペット (Nursery Rhymes ep2) | `瞳は野性、星はペット_(Nursery_Rhymes_ep2)-2090146a.md` |
| 4 | 薔薇とノンフィクション [PSY・S cover] | `薔薇とノンフィクション_[PSY・S_cover]-8b7005cb.md` |
| 4 | 記号化 (No No No) | `記号化_(No_No_No)-d7609050.md` |
| 4 | 記号化 (NONONO) | `記号化_(NONONO)-bf85fbc0.md` |
| 4 | 記憶と記録 | `記憶と記録-b071c12e.md` |
| 4 | 長い序章の終わりで (Law Name) | `長い序章の終わりで_(Law_Name)-fd112a0b.md` |
| 3 | 「ただいま」と「おやすみ」の間に (Nursery Rhymes ep1) [Lost Verse(s) ver.] | `「ただいま」と「おやすみ」の間に_(Nursery_Rhymes_ep1)_[Lost_Verse(s)_ver.]-a45b26e3.md` |
| 3 | ANALYNE [2018 remix] | `ANALYNE_[2018_remix]-8e441201.md` |
| 3 | Groria streetから愛を込めて #2 | `Groria_streetから愛を込めて_#2-68700164.md` |
| 3 | Grow to be a man | `Grow_to_be_a_man-b7c6f686.md` |
| 3 | Introduction- | `Introduction--b0aa9779.md` |
| 3 | Music from Twilight [門田→Key.] | `Music_from_Twilight_[門田→Key.]-fd05ec8b.md` |
| 3 | Perfect nervous_花 | `Perfect_nervous_花-6df5e93f.md` |
| 3 | SHINE A LIGHT | `SHINE_A_LIGHT-8ec99d82.md` |
| 3 | Star dust | `Star_dust-4c93a3a6.md` |
| 3 | SWEAR | `SWEAR-fec65869.md` |
| 3 | VIVACE -TiTs- | `VIVACE_-TiTs--e5445951.md` |
| 3 | クリスタル | `クリスタル-6b8802f5.md` |
| 3 | コミュニティ | `コミュニティ-53b17bf6.md` |
| 3 | パキシル | `パキシル-10a92385.md` |
| 3 | バネのいかれたベッドの上で (I Don't Wanna Grow Up) [Lost Verse(s) ver.] | `バネのいかれたベッドの上で_(I_Don't_Wanna_Grow_Up)_[Lost_Verse(s)_ver.]-ab90439d.md` |
| 3 | ビビ (UNKNOWN) | `ビビ_(UNKNOWN)-b764597d.md` |
| 3 | ファンタジア (What Makes You Beautiful) | `ファンタジア_(What_Makes_You_Beautiful)-bbfe45b8.md` |
| 3 | 例え話 | `例え話-3c76ced6.md` |
| 3 | 名も無い景色の中で (I Will Say Good Bye) | `名も無い景色の中で_(I_Will_Say_Good_Bye)-b2cc464c.md` |
| 3 | 名も無き景色の中で (I Will Say Good Bye) | `名も無き景色の中で_(I_Will_Say_Good_Bye)-d763d65f.md` |
| 3 | 埋立地 (弾き語り) | `埋立地_(弾き語り)-1e88633d.md` |
| 3 | 永遠に柔らかな罰を (Cheek-to-cheek Dancing for Broken hearts) -ver. D&D- | `永遠に柔らかな罰を_(Cheek-to-cheek_Dancing_for_Broken_hearts)_-ver._D&D--0d13d522.md` |
| 3 | 無限交響楽 | `無限交響楽-c9fd02d1.md` |
| 3 | 瓦礫のオルフェオ (Ombra mai fù) | `瓦礫のオルフェオ_(Ombra_mai_fù)-8deb38e2.md` |
| 3 | 神の犬 (Do Justice To?) [with 伊藤大地 (Dr.)] | `神の犬_(Do_Justice_To_)_[with_伊藤大地_(Dr.)]-1f7af60a.md` |
| 3 | 草の花 (Reboot ver.) | `草の花_(Reboot_ver.)-43494c09.md` |
| 3 | 間違い探し [門田→Key.] | `間違い探し_[門田→Key.]-604fdbe0.md` |
| 3 | 飛行記録 (フライトレコード) | `飛行記録_(フライトレコード)-e9ad03c4.md` |
| 2 | (?) | `(_)-a30ea2ae.md` |
| 2 | (Can you feel?) ～Most beautiful in the world～ [w/伊藤] | `(Can_you_feel_)_～Most_beautiful_in_the_world～_[w_伊藤]-b45d367b.md` |
| 2 | [Sweet heart of moon ?] | `[Sweet_heart_of_moon__]-dd89eb44.md` |
| 2 | 7月10日 | `7月10日-ad5d185d.md` |
| 2 | Alice -ver. D&D- | `Alice_-ver._D&D--b0f7ec08.md` |
| 2 | AM 4:00 | `AM_4_00-7d10b4fe.md` |
| 2 | ANALYZE [Lost Verse(s) ver.] | `ANALYZE_[Lost_Verse(s)_ver.]-42d55b79.md` |
| 2 | Blanket | `Blanket-60791989.md` |
| 2 | Blue moon [Richard Rodgers cover] | `Blue_moon_[Richard_Rodgers_cover]-858e5343.md` |
| 2 | Ghost | `Ghost-c4745785.md` |
| 2 | HOME SICK [内田Vo.] | `HOME_SICK_[内田Vo.]-88c9ba4c.md` |
| 2 | Introduction -D&D鉄道 入国アナウンス- | `Introduction_-D&D鉄道_入国アナウンス--386a07b1.md` |
| 2 | judgement | `judgement-392ab84c.md` |
| 2 | LESSON (BURGER NUDS) | `LESSON_(BURGER_NUDS)-b997538b.md` |
| 2 | Mrs. Vertigo [w/伊藤] | `Mrs._Vertigo_[w_伊藤]-ae7d17b7.md` |
| 2 | Natural Boon Queen | `Natural_Boon_Queen-6dd65ec6.md` |
| 2 | Nightmare's Biginning | `Nightmare's_Biginning-dccd7344.md` |
| 2 | Nightmares Beginning | `Nightmares_Beginning-edd341c7.md` |
| 2 | Opening -D&D鉄道 乗車アナウンス- | `Opening_-D&D鉄道_乗車アナウンス--8cf00fee.md` |
| 2 | エイプリル | `エイプリル-97a4c242.md` |
| 2 | キャンプファイアーソング | `キャンプファイアーソング-ff6fc90d.md` |
| 2 | キャンプファイヤーソング [w/伊藤] | `キャンプファイヤーソング_[w_伊藤]-11dae8e7.md` |
| 2 | ないよなにも [内田Vo.] | `ないよなにも_[内田Vo.]-57d29947.md` |
| 2 | バネのいかれたベッドの上で (I Don't Wanna Grow Up) [冒頭ボーカル: 水野] | `バネのいかれたベッドの上で_(I_Don't_Wanna_Grow_Up)_[冒頭ボーカル__水野]-c057cb2d.md` |
| 2 | プリズム | `プリズム-0162d094.md` |
| 2 | ホラー映画 | `ホラー映画-d9598b3e.md` |
| 2 | ユートピア [w/伊藤] | `ユートピア_[w_伊藤]-26a58f20.md` |
| 2 | ラスト・ハルマゲドン | `ラスト・ハルマゲドン-328b3839.md` |
| 2 | ラストハルマゲドン | `ラストハルマゲドン-4c8ca69b.md` |
| 2 | ワイン | `ワイン-176987c8.md` |
| 2 | 光の言語 (Absolute Blue) | `光の言語_(Absolute_Blue)-b3508ec3.md` |
| 2 | 分かる (CLOW) | `分かる_(CLOW)-a18a4513.md` |
| 2 | 刹那 | `刹那-196a56d6.md` |
| 2 | 微笑とメロディー (弾き語り) | `微笑とメロディー_(弾き語り)-a2767a97.md` |
| 2 | 日の出桟橋 (Song for lover's) | `日の出桟橋_(Song_for_lover's)-7c8a3ee1.md` |
| 2 | 春 (陽だまりを越えて) | `春_(陽だまりを越えて)-f400a12b.md` |
| 2 | 泥棒猫かく語りき (Nursery Rhymes ep3) | `泥棒猫かく語りき_(Nursery_Rhymes_ep3)-8602e85c.md` |
| 2 | 獄才色 | `獄才色-f129d4cb.md` |
| 2 | 草の花 (アレンジ版) | `草の花_(アレンジ版)-5df8645e.md` |
| 2 | 観覧車 | `観覧車-7e0e317e.md` |
| 2 | 陽だまりを超えて | `陽だまりを超えて-4d751994.md` |
| 2 | 黄金の鐘 (Split盤バージョン) | `黄金の鐘_(Split盤バージョン)-74a93996.md` |
| 1 | _trick or treat_ | `_trick_or_treat_-eba5cd0a.md` |
| 1 | _キャンプファイヤーソング_ | `_キャンプファイヤーソング_-16a81e07.md` |
| 1 | _微笑とメロディー_ | `_微笑とメロディー_-38bb7b35.md` |
| 1 | _息吹と共に混沌を裂いて_ | `_息吹と共に混沌を裂いて_-1f381dea.md` |
| 1 | _林檎_ | `_林檎_-be0309b2.md` |
| 1 | 〜 その自慰が終わったなら(Modern Ghost) | `〜_その自慰が終わったなら(Modern_Ghost)-4844de24.md` |
| 1 | 〜Star dust〜 | `〜Star_dust〜-e7fa157f.md` |
| 1 | (can you feel?) ～Most beautiful in the world～ (Acoustic ver.) | `(can_you_feel_)_～Most_beautiful_in_the_world～_(Acoustic_ver.)-f8ca34cf.md` |
| 1 | (can you feel?) ～Most beautiful in the world～ (セットリストには記載がない) | `(can_you_feel_)_～Most_beautiful_in_the_world～_(セットリストには記載がない)-e3a1115a.md` |
| 1 | (can you feel?) ～Most beautiful in the world～ (全員) | `(can_you_feel_)_～Most_beautiful_in_the_world～_(全員)-bb61df10.md` |
| 1 | (can you feel?) ～Most beautiful in the world～ (弾き語り) | `(can_you_feel_)_～Most_beautiful_in_the_world～_(弾き語り)-23dfdfec.md` |
| 1 | (can you feel?) ～Most beautiful in the world～ [with 吹奏楽部] | `(can_you_feel_)_～Most_beautiful_in_the_world～_[with_吹奏楽部]-77c16a0e.md` |
| 1 | (can you feel?)～Most bautiful in the world～ | `(can_you_feel_)～Most_bautiful_in_the_world～-bf08c634.md` |
| 1 | (con)crete (初披露) | `(con)crete_(初披露)-393bda02.md` |
| 1 | (HOMESICK ?) [内田Vo.Gt.] | `(HOMESICK__)_[内田Vo.Gt.]-2b057042.md` |
| 1 | (ないよなにも ?) [内田Vo.Gt.] | `(ないよなにも__)_[内田Vo.Gt.]-df6c4ef6.md` |
| 1 | (他3曲ほど) | `(他3曲ほど)-b9c5ba37.md` |
| 1 | (他に3曲程度?) | `(他に3曲程度_)-c9a3890a.md` |
| 1 | (無音トラック) [全国版のみ] | `(無音トラック)_[全国版のみ]-960a1725.md` |
| 1 | [不明] | `[不明]-01c54784.md` |
| 1 | 「ただいま」と「おやすみ」の間に (pajamas) | `「ただいま」と「おやすみ」の間に_(pajamas)-7881783a.md` |
| 1 | 「ただいま」と「おやすみ」の間に (pajamas) ◇ | `「ただいま」と「おやすみ」の間に_(pajamas)_◇-4246f71e.md` |
| 1 | ◆…スタジオ音源未リリースの楽曲 | `◆…スタジオ音源未リリースの楽曲-46357ee1.md` |
| 1 | ◇…スタジオ音源未リリースかつ、このライブが初披露の楽曲 | `◇…スタジオ音源未リリースかつ、このライブが初披露の楽曲-f37e5f68.md` |
| 1 | ♥ の JUNKY【2007】 | `♥_の_JUNKY【2007】-a2ed17a2.md` |
| 1 | 3/8 東京キネマ倶楽部 Off Shot | `3_8_東京キネマ倶楽部_Off_Shot-2359585c.md` |
| 1 | Alice (w/河相, メトロノーム) | `Alice_(w_河相,_メトロノーム)-23b964ff.md` |
| 1 | Alice (w/河相) | `Alice_(w_河相)-0ba4ece0.md` |
| 1 | Alice (メトロノーム使用) | `Alice_(メトロノーム使用)-27fb18ae.md` |
| 1 | AM 4:00 (自己暗示の日) | `AM_4_00_(自己暗示の日)-da372017.md` |
| 1 | AM4時 | `AM4時-946ebf7e.md` |
| 1 | ANALYZE (線) 作詞: BURGER NUDS | `ANALYZE_(線)_作詞__BURGER_NUDS-bb68a955.md` |
| 1 | ANALYZE [2018 remix] | `ANALYZE_[2018_remix]-99efe5d1.md` |
| 1 | ANALYZEE [2018 remix] | `ANALYZEE_[2018_remix]-d6040d94.md` |
| 1 | ANDANTINO -muse の楽団- 【1959】 | `ANDANTINO_-muse_の楽団-_【1959】-b160209d.md` |
| 1 | ANDANTINO -museの楽団- (Good Dog Happy Men) | `ANDANTINO_-museの楽団-_(Good_Dog_Happy_Men)-289b5d7b.md` |
| 1 | ANDANTINO -museの楽団- (弾き語り) | `ANDANTINO_-museの楽団-_(弾き語り)-0871257b.md` |
| 1 | ANDANTINO -museの楽団- [with 吹奏楽部] | `ANDANTINO_-museの楽団-_[with_吹奏楽部]-ff4560a6.md` |
| 1 | ANDANTINO −museの楽団− | `ANDANTINO_−museの楽団−-bb7b8596.md` |
| 1 | Apple star storyS 【Most beautiful in the world Tour 2006 FINAL / at_shinjuku LOFT（7/25)】 [全国版のみ] | `Apple_star_storyS_【Most_beautiful_in_the_world_Tour_2006_FINAL___at_shinjuku_LOF-43c78ec5.md` |
| 1 | Apple star storyS【2007】 | `Apple_star_storyS【2007】-ea6a2609.md` |
| 1 | AYATORI DEMO | `AYATORI_DEMO-d28a2587.md` |
| 1 | B D H M (w/内田, 韮沢) | `B_D_H_M_(w_内田,_韮沢)-cd5edfa1.md` |
| 1 | B D H M【1975】 | `B_D_H_M【1975】-173368ce.md` |
| 1 | Blue moom shadow | `Blue_moom_shadow-8fed48ed.md` |
| 1 | Blue Moon | `Blue_Moon-5dff0b09.md` |
| 1 | Blue Moon Shadow (with 山田[鍵盤ハーモニカ/Cho.]&河相[Gt./Cho.]) | `Blue_Moon_Shadow_(with_山田[鍵盤ハーモニカ_Cho.]&河相[Gt._Cho.])-8f6c91f7.md` |
| 1 | BRAVE GIRL IN HEL | `BRAVE_GIRL_IN_HEL-6b168111.md` |
| 1 | Bule Moon Shadow | `Bule_Moon_Shadow-9ceea839.md` |
| 1 | Calling You [Jeff Buckley (Jevetta Steele) cover] | `Calling_You_[Jeff_Buckley_(Jevetta_Steele)_cover]-22f9a4dd.md` |
| 1 | Calling You [Jevetta Steele cover] | `Calling_You_[Jevetta_Steele_cover]-bfea6047.md` |
| 1 | Calling You [Jevetta Steele cover] (弾き語り) | `Calling_You_[Jevetta_Steele_cover]_(弾き語り)-86409020.md` |
| 1 | Calling You [Jevetta Steele cover] (門田のみ) | `Calling_You_[Jevetta_Steele_cover]_(門田のみ)-5c4996a0.md` |
| 1 | Calling You [Jevette Steele cover] | `Calling_You_[Jevette_Steele_cover]-ad9235d1.md` |
| 1 | Candle for minority (BURGER NUDS) | `Candle_for_minority_(BURGER_NUDS)-16a55255.md` |
| 1 | Candle for minority (symphony) | `Candle_for_minority_(symphony)-e0ec4d8b.md` |
| 1 | Candle for minority (with 山田[Cho.]) | `Candle_for_minority_(with_山田[Cho.])-84a8dc3f.md` |
| 1 | Candle for minority (弾き語り) | `Candle_for_minority_(弾き語り)-fca08891.md` |
| 1 | CD Extra: | `CD_Extra_-aba60f55.md` |
| 1 | City Pop | `City_Pop-3a0d2503.md` |
| 1 | city pop (初披露) | `city_pop_(初披露)-7888a763.md` |
| 1 | Cocaine Blues [Ramblin' Jack Elliot cover] | `Cocaine_Blues_[Ramblin'_Jack_Elliot_cover]-bc4d3af0.md` |
| 1 | COLD BURN (TELESCOPE COMPILATION 01) | `COLD_BURN_(TELESCOPE_COMPILATION_01)-9b117607.md` |
| 1 | D.O.M | `D.O.M-d46e80ad.md` |
| 1 | Dear My Teacher (w/伊藤, 河相, 菅原) | `Dear_My_Teacher_(w_伊藤,_河相,_菅原)-72d059ab.md` |
| 1 | Departures | `Departures-361356da.md` |
| 1 | Down To Heaven | `Down_To_Heaven-057fb5a1.md` |
| 1 | ENCODA / ACONITES SUN | `ENCODA___ACONITES_SUN-4ffd05ce.md` |
| 1 | Ending: GOLDENBELLCITYのテーマ (スタッフロール) | `Ending__GOLDENBELLCITYのテーマ_(スタッフロール)-4b929724.md` |
| 1 | EVANGELIST | `EVANGELIST-0ce33d66.md` |
| 1 | EXAM | `EXAM-8b39e279.md` |
| 1 | fructose (w/河相) | `fructose_(w_河相)-70c33e60.md` |
| 1 | fructose (with 河相[Gt.]) | `fructose_(with_河相[Gt.])-5292ed43.md` |
| 1 | Fructose (未発表DEMO音源) / Poet-type.M | `Fructose_(未発表DEMO音源)___Poet-type.M-02b64e4f.md` |
| 1 | Fructose [ギターのみ] | `Fructose_[ギターのみ]-ecf19104.md` |
| 1 | Ghost (w/河相) | `Ghost_(w_河相)-00802f57.md` |
| 1 | Ghost Of Ghost Town | `Ghost_Of_Ghost_Town-2c03a231.md` |
| 1 | GOLDENBELLCITYのテーマ | `GOLDENBELLCITYのテーマ-d99a8fa0.md` |
| 1 | Good-Night.M | `Good-Night.M-35d6a0dd.md` |
| 1 | Grace | `Grace-fd1cf5e2.md` |
| 1 | Groria Street から愛を込めて #1 | `Groria_Street_から愛を込めて_#1-1048edd6.md` |
| 1 | Groria Street から愛を込めて#3 -嬉しくて哀しい事-【1981】 | `Groria_Street_から愛を込めて#3_-嬉しくて哀しい事-【1981】-0afde7fa.md` |
| 1 | Groria Street より愛を込めて #1 | `Groria_Street_より愛を込めて_#1-890da098.md` |
| 1 | Groria Streetから愛を込めて #3 −嬉しくて哀しい事− | `Groria_Streetから愛を込めて_#3_−嬉しくて哀しい事−-c898cc77.md` |
| 1 | HOME SICK [内田Vo./アコースティック編成] | `HOME_SICK_[内田Vo._アコースティック編成]-3bfbf15d.md` |
| 1 | HOMESICK [内田Vo./A.Gt] | `HOMESICK_[内田Vo._A.Gt]-24f023c3.md` |
| 1 | Hymne à l'amour (Poet-type.M ver.)­ | `Hymne_à_l'amour_(Poet-type.M_ver.)­-e207ebb3.md` |
| 1 | Hymne à l'amour (Poet-type.M ver.) [Édith Piaf cover] | `Hymne_à_l'amour_(Poet-type.M_ver.)_[Édith_Piaf_cover]-3168c463.md` |
| 1 | I Can't Help Falling Love [Elvis Presley cover] | `I_Can't_Help_Falling_Love_[Elvis_Presley_cover]-489d559a.md` |
| 1 | I Don't Wanna Grow Up | `I_Don't_Wanna_Grow_Up-1e54315e.md` |
| 1 | I LOVE YOU (w/河相, メトロノーム) | `I_LOVE_YOU_(w_河相,_メトロノーム)-7f414b1e.md` |
| 1 | I LOVE YOU (w/河相) | `I_LOVE_YOU_(w_河相)-0a258bb7.md` |
| 1 | I LOVE YOU (メトロノーム使用) | `I_LOVE_YOU_(メトロノーム使用)-01568467.md` |
| 1 | I love you, You love me / messer schmitt Jr. | `I_love_you,_You_love_me___messer_schmitt_Jr.-91cb6d9c.md` |
| 1 | Intro (即興セッション) | `Intro_(即興セッション)-3d85056e.md` |
| 1 | Jewel Box【1973】 | `Jewel_Box【1973】-616fa5e7.md` |
| 1 | Judgement;【1970】 | `Judgement;【1970】-4633f426.md` |
| 1 | Kireigoto ("あのキラキラした綺麗事を (AGAIN)" アコースティックバージョン) | `Kireigoto_(_あのキラキラした綺麗事を_(AGAIN)__アコースティックバージョン)-61f20016.md` |
| 1 | MARCH (線) | `MARCH_(線)-ce02a7b0.md` |
| 1 | MARCH LIVE Ver. | `MARCH_LIVE_Ver.-2f6fd11f.md` |
| 1 | MoYuRu [初披露] | `MoYuRu_[初披露]-eb362164.md` |
| 1 | Mrs. Vertigo | `Mrs._Vertigo-056446f7.md` |
| 1 | Mrs.Vertigo | `Mrs.Vertigo-3ae45383.md` |
| 1 | museの楽団 | `museの楽団-eed8d89b.md` |
| 1 | My Voice My Life / messer schmitt Jr. | `My_Voice_My_Life___messer_schmitt_Jr.-8b49b351.md` |
| 1 | narrow silhouette | `narrow_silhouette-6a93d904.md` |
| 1 | Natural Born Queen (w/内田, 韮沢) | `Natural_Born_Queen_(w_内田,_韮沢)-ce54c275.md` |
| 1 | Nightmare's Begining | `Nightmare's_Begining-970df0db.md` |
| 1 | Nightmare's Beginning (Acoustic ver.) | `Nightmare's_Beginning_(Acoustic_ver.)-ec84b546.md` |
| 1 | Normal Abnormal (symphony) | `Normal_Abnormal_(symphony)-4a3061aa.md` |
| 1 | omamagoto | `omamagoto-7b909af7.md` |
| 1 | Opening: GOLDENBELLCITYのテーマ | `Opening__GOLDENBELLCITYのテーマ-22cbd544.md` |
| 1 | Pajamas | `Pajamas-f409df10.md` |
| 1 | Perfect nervous [Poet-type.M ver] | `Perfect_nervous_[Poet-type.M_ver]-e84c5810.md` |
| 1 | Perfect nervous [弾き語り] | `Perfect_nervous_[弾き語り]-0148ad26.md` |
| 1 | POPCORN (w/伊藤, 河相, 菅原) | `POPCORN_(w_伊藤,_河相,_菅原)-bb73f42f.md` |
| 1 | POPCORN (with 河相[Gt.]) | `POPCORN_(with_河相[Gt.])-be546a7e.md` |
| 1 | Pretty little horses [w/伊藤] | `Pretty_little_horses_[w_伊藤]-a18b5e6d.md` |
| 1 | Prologue | `Prologue-bd484963.md` |
| 1 | prologue -Ergonomics(s)- | `prologue_-Ergonomics(s)--7bc8af75.md` |
| 1 | Say Good-bye / messer schmitt Jr. | `Say_Good-bye___messer_schmitt_Jr.-c2871929.md` |
| 1 | STEP [a・chi-a・chi (魔神英雄伝ワタルOP) cover] | `STEP_[a・chi-a・chi_(魔神英雄伝ワタルOP)_cover]-fdbba97a.md` |
| 1 | supple / ACONITES SUN | `supple___ACONITES_SUN-d8927693.md` |
| 1 | Sweet heart of moon (Good Dog Happy Men) | `Sweet_heart_of_moon_(Good_Dog_Happy_Men)-31329506.md` |
| 1 | Trick or Treat (弾き語り with 伊藤) | `Trick_or_Treat_(弾き語り_with_伊藤)-3dd5e65b.md` |
| 1 | Twice bird's singing | `Twice_bird's_singing-69eb6749.md` |
| 1 | Twice Bird's Singing (弾き語り) | `Twice_Bird's_Singing_(弾き語り)-6eec12c1.md` |
| 1 | Twice Birds’ Singing | `Twice_Birds’_Singing-607bcdee.md` |
| 1 | Twice Birds' Singing [2018 remix] | `Twice_Birds'_Singing_[2018_remix]-d72cfcaa.md` |
| 1 | UNKOWN | `UNKOWN-48d568aa.md` |
| 1 | UNO / ACONITES SUN | `UNO___ACONITES_SUN-81b6f507.md` |
| 1 | VIVACE -TiTs-【1940】 | `VIVACE_-TiTs-【1940】-63d76d98.md` |
| 1 | あのキラキラした綺麗事 (AGAIN) | `あのキラキラした綺麗事_(AGAIN)-56716310.md` |
| 1 | あの列車は荒野を目指す | `あの列車は荒野を目指す-abfa1430.md` |
| 1 | イプシロンは泣いていたよ [初披露] | `イプシロンは泣いていたよ_[初披露]-9a637d1e.md` |
| 1 | エコ－ | `エコ－-94cb983a.md` |
| 1 | エコー (BURGER NUDS) | `エコー_(BURGER_NUDS)-78a4055e.md` |
| 1 | エコー (kageokuri) | `エコー_(kageokuri)-872e03d3.md` |
| 1 | エコー (with Gt.楢原) | `エコー_(with_Gt.楢原)-ffa94dc9.md` |
| 1 | オリジナルディストピア | `オリジナルディストピア-4a650978.md` |
| 1 | カナリア [リクエスト] | `カナリア_[リクエスト]-6fb7b55e.md` |
| 1 | カナリヤ | `カナリヤ-f30bda7f.md` |
| 1 | キラキラするもの | `キラキラするもの-93ae4e42.md` |
| 1 | ゴスペル2 (It's Show Time) | `ゴスペル2_(It's_Show_Time)-fd36ac78.md` |
| 1 | コミュニティー (with Gt.楢原) | `コミュニティー_(with_Gt.楢原)-d219633b.md` |
| 1 | コミュニティー (新曲未発表DEMO音源) / BURGER NUDS | `コミュニティー_(新曲未発表DEMO音源)___BURGER_NUDS-e67f5209.md` |
| 1 | そして列車は行く [w/伊藤] | `そして列車は行く_[w_伊藤]-51507e1c.md` |
| 1 | そして列車は行く【1998】 | `そして列車は行く【1998】-2528ab34.md` |
| 1 | その自慰が終わったなら (Modern Ghost) ((オフィシャルサイトにはここに「窮屈、退屈、卑屈 (A-halo)」の記載もあるが、実際には演奏されていない。)) | `その自慰が終わったなら_(Modern_Ghost)_((オフィシャルサイトにはここに「窮屈、退屈、卑屈_(A-halo)」の記載もあるが、実際には演奏されてい-faeaa1d6.md` |
| 1 | その自慰が終わったなら(Modern Ghost) | `その自慰が終わったなら(Modern_Ghost)-107b4e45.md` |
| 1 | その自慰が終わったなら(Modern Ghost) [with 楢原] | `その自慰が終わったなら(Modern_Ghost)_[with_楢原]-e8c991d7.md` |
| 1 | その自慰が終わったら | `その自慰が終わったら-784ccfad.md` |
| 1 | ダイヤモンドは傷つかない (In Memory Of Louis) [楢原→Pf.] | `ダイヤモンドは傷つかない_(In_Memory_Of_Louis)_[楢原→Pf.]-52c2b0d7.md` |
| 1 | ダイヤモンドは傷つかない (In memory of Louis) [楢原→Vn.] | `ダイヤモンドは傷つかない_(In_memory_of_Louis)_[楢原→Vn.]-6711164f.md` |
| 1 | だが、ワインは 赫 ( あか ) (Deep Red Wine) | `だが、ワインは_赫_(_あか_)_(Deep_Red_Wine)-765ff3ff.md` |
| 1 | だが、ワインは赫 (Deep Red Wine) [with 弦楽四重奏] | `だが、ワインは赫_(Deep_Red_Wine)_[with_弦楽四重奏]-acaef342.md` |
| 1 | タネリ (with Vn.楢原) | `タネリ_(with_Vn.楢原)-af5a9203.md` |
| 1 | タネリ (弾き語り) | `タネリ_(弾き語り)-f7bdf459.md` |
| 1 | タネリ (自己暗示の日) | `タネリ_(自己暗示の日)-dd014230.md` |
| 1 | タネリ [ギターのみ] | `タネリ_[ギターのみ]-9a9471c1.md` |
| 1 | タネリ [門田弾き語り] | `タネリ_[門田弾き語り]-7ebc6350.md` |
| 1 | タネリ feat.初音ミク | `タネリ_feat.初音ミク-1e4a54bb.md` |
| 1 | ディストピア | `ディストピア-a776fd41.md` |
| 1 | ディストピア (ショートバージョン) | `ディストピア_(ショートバージョン)-1ab5b9b7.md` |
| 1 | ディストピア (弾き語り) | `ディストピア_(弾き語り)-a021c798.md` |
| 1 | ドーナツ (w/伊藤, 河相, 菅原) | `ドーナツ_(w_伊藤,_河相,_菅原)-736d2aee.md` |
| 1 | ドーナツ (w/河相) | `ドーナツ_(w_河相)-66ee0e0d.md` |
| 1 | ないよなにも [内田Vo.] (HOME SICKと順番逆?) | `ないよなにも_[内田Vo.]_(HOME_SICKと順番逆_)-c91ffd4c.md` |
| 1 | ないよなにも [内田Vo./A.Gt] | `ないよなにも_[内田Vo._A.Gt]-50ead998.md` |
| 1 | ネクスト東京 | `ネクスト東京-e7169d34.md` |
| 1 | ハウリングムーン (未発表) | `ハウリングムーン_(未発表)-94175b2c.md` |
| 1 | パスタ (w/内田) | `パスタ_(w_内田)-f3cb0912.md` |
| 1 | バネのいかれたベットの上で (I Don't Wanna Grow Up) | `バネのいかれたベットの上で_(I_Don't_Wanna_Grow_Up)-eb5e76f0.md` |
| 1 | バネのいかれたベッドの上で (I Don’t Wanna Grow Up) | `バネのいかれたベッドの上で_(I_Don’t_Wanna_Grow_Up)-4b371f81.md` |
| 1 | バネのいかれたベッドの上で (I Don't Wanna Grow Up) [with 弦楽四重奏] | `バネのいかれたベッドの上で_(I_Don't_Wanna_Grow_Up)_[with_弦楽四重奏]-e0e5e347.md` |
| 1 | バネのいかれたベッドの上で (I Don't Wanna Grow Up) [with 楢原] | `バネのいかれたベッドの上で_(I_Don't_Wanna_Grow_Up)_[with_楢原]-8abb73a6.md` |
| 1 | バネのいかれたベッドの上で (I Don't Wanna Grow Up) ◆ | `バネのいかれたベッドの上で_(I_Don't_Wanna_Grow_Up)_◆-90657996.md` |
| 1 | バネのいかれたベットの上で (I don't wonna grow up) | `バネのいかれたベットの上で_(I_don't_wonna_grow_up)-834a88bb.md` |
| 1 | ファンタジア (What Makes You Beautiful) (Reboot ver.) | `ファンタジア_(What_Makes_You_Beautiful)_(Reboot_ver.)-07066002.md` |
| 1 | ファンタジア (What Makes You Beautiful) [with 楢原] | `ファンタジア_(What_Makes_You_Beautiful)_[with_楢原]-5e22d7e4.md` |
| 1 | プリズム encore break | `プリズム_encore_break-10d6d969.md` |
| 1 | ホームシック | `ホームシック-e82d3232.md` |
| 1 | マーチ | `マーチ-b5640a9a.md` |
| 1 | ミナソコ (Acoustic Verison) | `ミナソコ_(Acoustic_Verison)-2adbea6b.md` |
| 1 | ミナソコ (TELESCOPE COMPILATION 01/LOW NAME) | `ミナソコ_(TELESCOPE_COMPILATION_01_LOW_NAME)-96d57f9a.md` |
| 1 | ミナソコ (with 山田[Cho.]) | `ミナソコ_(with_山田[Cho.])-d6a14a63.md` |
| 1 | ミナソコ (弾き語り) | `ミナソコ_(弾き語り)-6c3711e4.md` |
| 1 | ミナソコ (短縮版) [門田弾き語り] | `ミナソコ_(短縮版)_[門田弾き語り]-8cfca09d.md` |
| 1 | ミナソコ [エレキ弾き語り] | `ミナソコ_[エレキ弾き語り]-695e72ec.md` |
| 1 | もう、夢の無い夢の終わり (From Here to Eternity) (Poet-type.M) | `もう、夢の無い夢の終わり_(From_Here_to_Eternity)_(Poet-type.M)-772cb91e.md` |
| 1 | もう、夢の無い夢の終わり (From Here to Eternity) ◆ | `もう、夢の無い夢の終わり_(From_Here_to_Eternity)_◆-d6560b77.md` |
| 1 | 不感症 (symphony) | `不感症_(symphony)-c12f69fd.md` |
| 1 | 主よ、人の望みの喜びよ | `主よ、人の望みの喜びよ-5d47603a.md` |
| 1 | 二匹の猫の為のエチュード (門田のみ) | `二匹の猫の為のエチュード_(門田のみ)-550e2bf2.md` |
| 1 | 今、万感の想いを込めて【20XX】 | `今、万感の想いを込めて【20XX】-847c13ca.md` |
| 1 | 以下の楽曲をメドレーで演奏 | `以下の楽曲をメドレーで演奏-060ae93f.md` |
| 1 | 例え話 (初披露) | `例え話_(初披露)-5aa2dfea.md` |
| 1 | 倖 (弾き語り) | `倖_(弾き語り)-76dac5d5.md` |
| 1 | 優しい闇の中へ | `優しい闇の中へ-6b31fed7.md` |
| 1 | 優しい闇の中へ (弾き語り) | `優しい闇の中へ_(弾き語り)-1f72d449.md` |
| 1 | 光の粒子 埃の中で (Departures) (Poet-type.M) | `光の粒子_埃の中で_(Departures)_(Poet-type.M)-97dc5a0a.md` |
| 1 | 処分保留 [初披露] | `処分保留_[初披露]-2c453767.md` |
| 1 | 勇敢な指揮者～大行進【1920】 | `勇敢な指揮者～大行進【1920】-46d0814b.md` |
| 1 | 即興No.3 [門田弾き語り] | `即興No.3_[門田弾き語り]-f7de51aa.md` |
| 1 | 双子座のミステリー、 孤児 ( みなしご ) のシンパシー (GPS) | `双子座のミステリー、_孤児_(_みなしご_)_のシンパシー_(GPS)-92a463c2.md` |
| 1 | 双子座のミステリー、 孤児のシンパシー (GPS) | `双子座のミステリー、_孤児のシンパシー_(GPS)-999e69bb.md` |
| 1 | 双子座のミステリー、孤児のシンパシー (GPS) ◇ | `双子座のミステリー、孤児のシンパシー_(GPS)_◇-c8506967.md` |
| 1 | 名も無き景色の中で (I Will Say Goodbye) | `名も無き景色の中で_(I_Will_Say_Goodbye)-76e270f0.md` |
| 1 | 吐息達の棲み家 (w/伊藤) | `吐息達の棲み家_(w_伊藤)-2e2b0ef2.md` |
| 1 | 吐息達の棲み家 (弾き語り with 伊藤) | `吐息達の棲み家_(弾き語り_with_伊藤)-3b789d69.md` |
| 1 | 吐息達の棲み家 (弾き語り) | `吐息達の棲み家_(弾き語り)-9150f9ab.md` |
| 1 | 唱えよ、春 静か (XIII) [楢原→Vn.] | `唱えよ、春_静か_(XIII)_[楢原→Vn.]-a050eb56.md` |
| 1 | 唱えよ、春 静か (XIII) ◆ | `唱えよ、春_静か_(XIII)_◆-4c62a503.md` |
| 1 | 唱えよ、春静か (XIII) | `唱えよ、春静か_(XIII)-adaef8f0.md` |
| 1 | 堕天使達のバラッド | `堕天使達のバラッド-11146e65.md` |
| 1 | 天使さん (忌井三弦 with 門田[Cho.]) | `天使さん_(忌井三弦_with_門田[Cho.])-2720fd42.md` |
| 1 | 宅録セッション Off Shot | `宅録セッション_Off_Shot-a624fece.md` |
| 1 | 廃墟の子供たち −黒い羊水− | `廃墟の子供たち_−黒い羊水−-4f25b1d0.md` |
| 1 | 廃墟の子供達 -黒い羊水-【1990】 | `廃墟の子供達_-黒い羊水-【1990】-4e3b22ba.md` |
| 1 | 微笑とメロディー | `微笑とメロディー-faf76285.md` |
| 1 | 微笑とメロディー (別アレンジ版) | `微笑とメロディー_(別アレンジ版)-88bf5fa6.md` |
| 1 | 微笑メロディー | `微笑メロディー-0fe71b47.md` |
| 1 | 快楽 (Overdose) | `快楽_(Overdose)-3bf3b05e.md` |
| 1 | 性器を無くしたアンドロイド (Dystopia) [with 弦楽四重奏] | `性器を無くしたアンドロイド_(Dystopia)_[with_弦楽四重奏]-6a109c5d.md` |
| 1 | 性器を無くしたアンドロイド (Dystopia) ◇ | `性器を無くしたアンドロイド_(Dystopia)_◇-f69cfca4.md` |
| 1 | 慈しみだけで、頷くから (JUST LIKE LEGACY) DEMO | `慈しみだけで、頷くから_(JUST_LIKE_LEGACY)_DEMO-4e0552e4.md` |
| 1 | 慈しみだけで、頷くから [初披露] | `慈しみだけで、頷くから_[初披露]-15c35709.md` |
| 1 | 慈しみだけで頷くから | `慈しみだけで頷くから-bf45acb9.md` |
| 1 | 慈しみだけで頷くから (JUST LIKE LEGACY) | `慈しみだけで頷くから_(JUST_LIKE_LEGACY)-6df97955.md` |
| 1 | 慰霊堂清掃奉仕(Happy Birthday!) | `慰霊堂清掃奉仕(Happy_Birthday!)-f9bb7b35.md` |
| 1 | 慰霊堂清掃奉仕（Happy Birthday！） | `慰霊堂清掃奉仕（Happy_Birthday！）-35dfd885.md` |
| 1 | 指輪 (symphony) | `指輪_(symphony)-7f361eeb.md` |
| 1 | 救えない。心から。 (V.I.C.T.O.R.Y.) ◆ | `救えない。心から。_(V.I.C.T.O.R.Y.)_◆-de577f94.md` |
| 1 | 救えない。心から。(V.I.C.T.O.R.Y) | `救えない。心から。(V.I.C.T.O.R.Y)-59bece80.md` |
| 1 | 暗証番号 (w/河相) | `暗証番号_(w_河相)-80004e1a.md` |
| 1 | 極彩色 [初披露] | `極彩色_[初披露]-2b913098.md` |
| 1 | 楽園の追放者 (Somebody To Love) ◆ | `楽園の追放者_(Somebody_To_Love)_◆-d77f86fe.md` |
| 1 | 永遠 ( とわ ) の終わりまで、「YES」を (A Place, Dark & Dark) | `永遠_(_とわ_)_の終わりまで、「YES」を_(A_Place,_Dark_&_Dark)-e66f3bab.md` |
| 1 | 永遠に柔らかな罰を (Cheek-to-cheek Dancing for Broken hearts) [楢原→Pf.] | `永遠に柔らかな罰を_(Cheek-to-cheek_Dancing_for_Broken_hearts)_[楢原→Pf.]-0574befd.md` |
| 1 | 永遠の終わりまで、「YES」を (A Place, Dark & Dark) [with 弦楽四重奏] | `永遠の終わりまで、「YES」を_(A_Place,_Dark_&_Dark)_[with_弦楽四重奏]-46b269c2.md` |
| 1 | 決められたリズム (井上陽水) | `決められたリズム_(井上陽水)-5a5547be.md` |
| 1 | 泥棒猫のかく語りき (Nursery Rhymes ep3) | `泥棒猫のかく語りき_(Nursery_Rhymes_ep3)-493a112c.md` |
| 1 | 無限交響曲 | `無限交響曲-668d9c29.md` |
| 1 | 無限交響楽 (Lyrics by 門田匡陽 & 内田武瑠) | `無限交響楽_(Lyrics_by_門田匡陽_&_内田武瑠)-bd7b7081.md` |
| 1 | 瓦礫のオルフェオ (Ombra mai fù) [with 楢原] | `瓦礫のオルフェオ_(Ombra_mai_fù)_[with_楢原]-cffaae1b.md` |
| 1 | 番人ワルツ | `番人ワルツ-4667ac57.md` |
| 1 | 番人ワルツ (?) | `番人ワルツ_(_)-e11b53d8.md` |
| 1 | 番人ワルツ [内田Vo.] | `番人ワルツ_[内田Vo.]-33048b4b.md` |
| 1 | 疾れ! DOMINO! (Guitar insturmental) | `疾れ!_DOMINO!_(Guitar_insturmental)-ffb9ca7a.md` |
| 1 | 疾れ!DOMINO! (Guitar insturmental) | `疾れ!DOMINO!_(Guitar_insturmental)-902792fc.md` |
| 1 | 疾れ！DOMINO! (Guitar insturmental) | `疾れ！DOMINO!_(Guitar_insturmental)-3a44d4d8.md` |
| 1 | 神の犬 (Do Justice To?) [門田→Vo.のみ、楢原→Pf.] | `神の犬_(Do_Justice_To_)_[門田→Vo.のみ、楢原→Pf.]-85ed87f8.md` |
| 1 | 神の犬 (Do Justice To?) ◇ | `神の犬_(Do_Justice_To_)_◇-c1c589f9.md` |
| 1 | 神様ごっこ (弾き語り) | `神様ごっこ_(弾き語り)-5f25cbe8.md` |
| 1 | 空気清浄器 | `空気清浄器-46afcb5d.md` |
| 1 | 窮屈、退屈、卑屈 (A-halo) ◆ | `窮屈、退屈、卑屈_(A-halo)_◆-533606b6.md` |
| 1 | 自由も孤独もいらなくなって (Good Dog Happy Men) | `自由も孤独もいらなくなって_(Good_Dog_Happy_Men)-2b39cfdc.md` |
| 1 | 自由も孤独もいらなくなって (メンバー紹介) [w/伊藤] | `自由も孤独もいらなくなって_(メンバー紹介)_[w_伊藤]-060e32ea.md` |
| 1 | 草の花 (2019remix) | `草の花_(2019remix)-6c1747aa.md` |
| 1 | 草の花 [2019 remix] | `草の花_[2019_remix]-0f5e7cee.md` |
| 1 | 薔薇とノンフィクション (PSY・S) | `薔薇とノンフィクション_(PSY・S)-cd34d7e8.md` |
| 1 | 蝙蝠橋警備隊_春 | `蝙蝠橋警備隊_春-5762d4cb.md` |
| 1 | 蝙蝠橋警備隊_春 ("Sweet heart of moon" rearrange) | `蝙蝠橋警備隊_春_(_Sweet_heart_of_moon__rearrange)-a87a80b6.md` |
| 1 | 蝙蝠警備隊 ("Sweet heart of moon" rearrange) | `蝙蝠警備隊_(_Sweet_heart_of_moon__rearrange)-8993e4e2.md` |
| 1 | 記憶と記録【2000】 | `記憶と記録【2000】-7df2cbc7.md` |
| 1 | 誇りの響き 光の中へ (White White White) (セットリストに記載なし) | `誇りの響き_光の中へ_(White_White_White)_(セットリストに記載なし)-b70a3450.md` |
| 1 | 誇りの響き 光の中へ (White White White) [ギターのみ] | `誇りの響き_光の中へ_(White_White_White)_[ギターのみ]-8f2af731.md` |
| 1 | 調律するかのように | `調律するかのように-88ae2970.md` |
| 1 | 調律するかのように (Over The Rainbow) (Poet-type.M) | `調律するかのように_(Over_The_Rainbow)_(Poet-type.M)-f45e350f.md` |
| 1 | 調律するかのように (Over The Rainbow) (セットリストに記載なし) | `調律するかのように_(Over_The_Rainbow)_(セットリストに記載なし)-b8d6d2c6.md` |
| 1 | 調律するかのように (Over The Rainbow) [リクエスト] | `調律するかのように_(Over_The_Rainbow)_[リクエスト]-82a78753.md` |
| 1 | 調律するかの様に (Over The Rainbow) | `調律するかの様に_(Over_The_Rainbow)-9a220cc8.md` |
| 1 | 贖罪の夜、オーケストラは鳴り止まず (Modern Romance) | `贖罪の夜、オーケストラは鳴り止まず_(Modern_Romance)-e8e688da.md` |
| 1 | 贖罪の夜、オーケストラは鳴り止まず (Modern Romance) [with 楢原] | `贖罪の夜、オーケストラは鳴り止まず_(Modern_Romance)_[with_楢原]-75af0060.md` |
| 1 | 逆光 (TELESCOPE COMPILATION 01/線) | `逆光_(TELESCOPE_COMPILATION_01_線)-9f06f0b4.md` |
| 1 | 逆光 (弾き語り) | `逆光_(弾き語り)-e2cc9c34.md` |
| 1 | 逆光 [弾き語り] | `逆光_[弾き語り]-7d946fed.md` |
| 1 | 過呼吸 (Only you) | `過呼吸_(Only_you)-718a9aa3.md` |
| 1 | 過呼吸 (Only you) feat.初音ミク | `過呼吸_(Only_you)_feat.初音ミク-1e519981.md` |
| 1 | 過呼吸（Only you）DEMO | `過呼吸（Only_you）DEMO-7fd1afe5.md` |
| 1 | 過呼吸（Only you）初音ミクVer | `過呼吸（Only_you）初音ミクVer-4cd66dae.md` |
| 1 | 遺出物取り扱い係り | `遺出物取り扱い係り-44187ef2.md` |
| 1 | 遺失物取り扱い係 | `遺失物取り扱い係-2158e04e.md` |
| 1 | 遺失物取り扱い係り (rearrange) | `遺失物取り扱い係り_(rearrange)-554b4c52.md` |
| 1 | 酸素 [バンド初披露] | `酸素_[バンド初披露]-58f845f4.md` |
| 1 | 鋼鉄の朝 (kageokuri) | `鋼鉄の朝_(kageokuri)-3813ca5d.md` |
| 1 | 鍛冶屋 花火師 ピエロ【1950】 | `鍛冶屋_花火師_ピエロ【1950】-a42d8068.md` |
| 1 | 間違い探し | `間違い探し-29ad052d.md` |
| 1 | 陽だまりを越えて [弾き語り] | `陽だまりを越えて_[弾き語り]-2633003c.md` |
| 1 | 雨と仲良く (弾き語り) | `雨と仲良く_(弾き語り)-aa9af653.md` |
| 1 | 風の音符 歓喜の声 和音 (バージョン違い) | `風の音符_歓喜の声_和音_(バージョン違い)-8e43fdb2.md` |
| 1 | 風の音符 歓喜の声 和音 (門田ソロ) | `風の音符_歓喜の声_和音_(門田ソロ)-0e89ba21.md` |
| 1 | 飛行記録 (w/内田, 韮沢) | `飛行記録_(w_内田,_韮沢)-8dc54ea4.md` |
| 1 | 駄洒落 (弾き語り) | `駄洒落_(弾き語り)-fb913480.md` |
| 1 | 黄金の鐘 (2005年自主録音 オリジナルバージョン) / Good Dog Happy Men | `黄金の鐘_(2005年自主録音_オリジナルバージョン)___Good_Dog_Happy_Men-649cf9f4.md` |
| 1 | 黄金の鐘 (encore) | `黄金の鐘_(encore)-140da005.md` |
| 1 | 黄金の鐘【1980】 | `黄金の鐘【1980】-16fa43db.md` |
