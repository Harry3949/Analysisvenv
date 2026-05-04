document.addEventListener('DOMContentLoaded', () => {
    const chatWindow = document.getElementById('chat-window');
    const controls = document.getElementById('quiz-controls');
    const typing = document.getElementById('typing');
    const body = document.body;
    const lang = body.dataset.lang;
    const username = body.dataset.username || 'Guest';
    const userIcon = body.dataset.userIcon || '/static/img/logo.png';

    let currentStep = -1;
    let scores = { nova: 0, lumi: 0, neutral: 0 };

    const dialogue = [
        {
            who: "nova",
            ja: `やっほー、${username}！今日は君の「真の音楽性」を暴きに来たよ！準備はいい？`,
            en: `Hey ${username}! I'm here to reveal your 'True Music Personality'! Ready?`,
            options: [
                { ja: "準備万端だよ！", en: "Ready as I'll ever be!", type: "neutral" },
                { ja: "手加減してね...", en: "Go easy on me...", type: "neutral" }
            ]
        },
        {
            who: "lumi",
            ja: "ふふ、そんなに緊張しないで。まずは、君が一番『心拍数』が上がるリズムについて教えて？",
            en: "Hehe, don't be so nervous. First, tell me which rhythm makes your heart race the most?",
            options: [
                { ja: "疾走感のある激しいビート！", en: "Fast-paced, intense beats!", type: "nova" },
                { ja: "ゆったりとした包み込むようなリズム", en: "Slow, immersive rhythms", type: "lumi" }
            ]
        },
        {
            who: "nova",
            ja: "なるほどね！じゃあ次は私の番。音の「重なり」はどんな感じが好きかな？",
            en: "I see! My turn then. How do you like your sound 'layers'?",
            options: [
                { ja: "たくさんの音が複雑に混ざり合う感じ！", en: "Complex layers of many sounds!", type: "nova" },
                { ja: "シンプルで、一つ一つの音が際立つ感じ", en: "Simple, where each sound stands out", type: "lumi" }
            ]
        },
        {
            who: "lumi",
            ja: "音の隙間も大切だよね……。ところで、音楽の中に「人の声」はどのくらい必要だと思う？",
            en: "The space between sounds is important too... By the way, how much 'human voice' do you need in music?",
            options: [
                { ja: "圧倒的なエネルギーを持つボーカル！", en: "Powerful, high-energy vocals!", type: "nova" },
                { ja: "楽器の響きや、加工された不思議な声", en: "Instrumental echoes or processed voices", type: "lumi" }
            ]
        },
        {
            who: "nova",
            ja: "歌声も楽器の一つだもんね！じゃあ、君が音楽に求める「一番の刺激」は何かな？",
            en: "Vocals are like instruments too! So, what's the 'ultimate thrill' you seek in music?",
            options: [
                { ja: "聴くだけで元気が爆発するような快感！", en: "An explosion of pure energy!", type: "nova" },
                { ja: "心の奥底に静かに染み渡るような感動", en: "A deep, quiet emotional resonance", type: "lumi" }
            ]
        },
        {
            who: "lumi",
            ja: "素敵な答え……。最後は私から。もし最高の音楽を聴くなら、どんな場所で聴きたいかな？",
            en: "What a lovely answer... One last question from me. Where would you like to listen to the best music?",
            options: [
                { ja: "熱気あふれるライブハウスやクラブ", en: "An energetic live house or club", type: "nova" },
                { ja: "一人で静かに過ごす、深夜の自室", en: "A quiet room at midnight, alone", type: "lumi" }
            ]
        }
    ];

    window.addMessage = function(who, text) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `msg ${who}`;
        
        let iconSrc = "/static/img/logo.png";
        if (who === 'nova') iconSrc = "/static/img/nova.png";
        if (who === 'lumi') iconSrc = "/static/img/lumi.png";
        if (who === 'user') iconSrc = userIcon;

        msgDiv.innerHTML = `
            <img src="${iconSrc}" class="msg-icon">
            <div class="msg-bubble">${text}</div>
        `;
        chatWindow.appendChild(msgDiv);
        chatWindow.scrollTop = chatWindow.scrollHeight;
    };

    window.nextStep = async function(userChoiceText = null, type = null) {
        if (userChoiceText) {
            addMessage('user', userChoiceText);
            if (type) scores[type]++;
            controls.innerHTML = "";
        }

        currentStep++;

        if (currentStep < dialogue.length) {
            const step = dialogue[currentStep];
            typing.style.display = 'block';
            typing.innerText = `${step.who === 'nova' ? 'Nova' : 'Lumi'} is typing...`;
            
            await new Promise(r => setTimeout(r, 1200));
            
            typing.style.display = 'none';
            addMessage(step.who, lang === 'ja' ? step.ja : step.en);

            let html = "";
            step.options.forEach(opt => {
                const text = lang === 'ja' ? opt.ja : opt.en;
                html += `<button class="quiz-option" onclick="nextStep('${text}', '${opt.type}')">${text}</button>`;
            });
            controls.innerHTML = html;
        } else {
            showResult();
        }
    };

    async function showResult() {
        typing.style.display = 'block';
        typing.innerText = "Calculating your destiny...";
        await new Promise(r => setTimeout(r, 2000));
        typing.style.display = 'none';
        
        let resultType = "";
        let resultDesc = "";
        let resultColor = "#00e5ff";
        let novaComment = "";
        let lumiComment = "";

        if (scores.nova > scores.lumi) {
            resultType = lang === 'ja' ? "エネルギッシュな【NOVA】タイプ" : "Energetic [NOVA] Type";
            resultDesc = lang === 'ja' ? "君の魂は未来のビートを刻んでいる。高速なリズムとデジタルな熱量が、君の真価を証明するよ！" : "Your soul beats to the rhythm of the future. High-speed rhythms and digital heat are what define you!";
            resultColor = "#00e5ff";
            novaComment = lang === 'ja' ? `やったね、${username}！君からは熱いパッションを感じるよ。私と一緒に最高にアッパーな曲を探しに行こう！` : `Yay, ${username}! I can feel your hot passion. Let's go find the most upbeat tracks together!`;
            lumiComment = lang === 'ja' ? "ふふ、ノヴァと気が合いそう。激しい音の中に、君の強さが隠れているのかもね。" : "Hehe, you seem to get along with Nova. Your strength might be hidden within those intense sounds.";
        } else if (scores.lumi > scores.nova) {
            resultType = lang === 'ja' ? "幻想的な【LUMI】タイプ" : "Mystical [LUMI] Type";
            resultDesc = lang === 'ja' ? "君の心には、深い海のような豊かな感情が眠っている。アンビエントな広がりや、美しいメロディックな旋律が君の真価を引き出してくれるよ。" : "Your heart holds rich emotions like a deep ocean. Ambient textures and beautiful melodic lines are what will bring out your true potential.";
            resultColor = "#ff00ff";
            lumiComment = lang === 'ja' ? `${username}さんの波長、とっても綺麗……。静寂を愛するその感性、私が大切に守ってあげたいな。` : `${username}'s wavelength is so beautiful... I want to cherish that sensitivity of yours that loves the silence.`;
            novaComment = lang === 'ja' ? "おっ、ルミとお揃いだね！落ち着いた中にも、一本筋の通ったカッコよさを感じるよ！" : "Oh, you're just like Lumi! Even in the calm, I can feel a cool, steady core in you!";
        } else {
            resultType = lang === 'ja' ? "調和を愛する【HYBRID】タイプ" : "Harmony-loving [HYBRID] Type";
            resultDesc = lang === 'ja' ? "君はあらゆる音の要素をバランスよく取り込める、稀有な感性の持ち主だ。激しさと静寂を自在に行き来することで、新しい音楽の形が見つかるはず。" : "You possess a rare sensitivity, balancing all musical elements perfectly. By moving between intensity and silence, you'll find new musical forms.";
            resultColor = "#fff";
            novaComment = lang === 'ja' ? `${username}はバランス感覚バツグンだね！どんな曲でも着こなせちゃうなんて、無敵じゃない！？` : `${username}, your sense of balance is amazing! Being able to pull off any track... aren't you invincible!?`;
            lumiComment = lang === 'ja' ? "激しさと静寂、どちらも君の一部なんだね。とても不思議で、魅力的な響きを感じるよ。" : "Both intensity and silence are parts of you. I feel a very mysterious and charming resonance.";
        }

        addMessage('nova', novaComment);
        await new Promise(r => setTimeout(r, 1500));
        addMessage('lumi', lumiComment);
        await new Promise(r => setTimeout(r, 1500));

        const splash = document.createElement('div');
        splash.className = 'result-splash';
        splash.style.borderColor = resultColor;
        splash.innerHTML = `
            <h2 style="color: ${resultColor}; font-size: 2rem; margin-bottom: 20px;">${resultType}</h2>
            <p style="margin-bottom: 30px; line-height: 1.6;">${resultDesc}</p>
            <button class="secondary-btn" onclick="location.href='/'">${lang === 'ja' ? 'ラボに戻る' : 'Back to Lab'}</button>
        `;
        chatWindow.appendChild(splash);
        chatWindow.scrollTop = chatWindow.scrollHeight;
    }

    // 初期実行
    nextStep();
});
