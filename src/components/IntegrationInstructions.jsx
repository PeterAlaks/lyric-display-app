import React, { useState, useEffect } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Monitor, Video, Cast, Check, Network, Copy } from 'lucide-react';

export function IntegrationInstructions({ darkMode }) {
    const [localIP, setLocalIP] = useState('localhost');
    const [activeTab, setActiveTab] = useState('obs');

    useEffect(() => {
        if (window.electronAPI?.getLocalIP) {
            window.electronAPI.getLocalIP().then(ip => {
                if (ip && ip !== 'localhost') setLocalIP(ip);
            }).catch(() => { });
        }
    }, []);

    return (
        <div className="flex flex-col h-full">
            {/* Fixed Header with Tabs */}
            <div className={`flex-shrink-0 pb-4 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className={`w-full h-12 p-1 ${darkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
                        <TabsTrigger
                            value="obs"
                            className={`flex-1 h-10 gap-2 ${darkMode ? 'data-[state=active]:bg-gray-100' : 'data-[state=active]:bg-white'}`}
                        >
                            <Monitor className="w-4 h-4" />
                            <span className="font-medium">OBS Studio</span>
                        </TabsTrigger>
                        <TabsTrigger
                            value="vmix"
                            className={`flex-1 h-10 gap-2 ${darkMode ? 'data-[state=active]:bg-gray-100' : 'data-[state=active]:bg-white'}`}
                        >
                            <Video className="w-4 h-4" />
                            <span className="font-medium">vMix</span>
                        </TabsTrigger>
                        <TabsTrigger
                            value="wirecast"
                            className={`flex-1 h-10 gap-2 ${darkMode ? 'data-[state=active]:bg-gray-100' : 'data-[state=active]:bg-white'}`}
                        >
                            <Cast className="w-4 h-4" />
                            <span className="font-medium">Wirecast</span>
                        </TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto pt-6 px-1 min-h-0">
                <Tabs value={activeTab}>
                    <TabsContent value="obs" className="mt-0">
                        <OBSInstructions darkMode={darkMode} localIP={localIP} />
                    </TabsContent>
                    <TabsContent value="vmix" className="mt-0">
                        <VMixInstructions darkMode={darkMode} localIP={localIP} />
                    </TabsContent>
                    <TabsContent value="wirecast" className="mt-0">
                        <WirecastInstructions darkMode={darkMode} localIP={localIP} />
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}

// OBS Instructions
function OBSInstructions({ darkMode, localIP }) {
    return (
        <div className="space-y-6 pb-4">
            <IntroSection darkMode={darkMode}>
                LyricDisplay works with OBS Studio through a browser source. Think of it as a transparent window that displays your lyrics over your video feed.
            </IntroSection>

            <SetupOption
                icon={<Monitor className="w-5 h-5" />}
                title="Same Computer Setup"
                badge="Easiest"
                badgeColor="green"
                darkMode={darkMode}
            >
                <SetupDescription darkMode={darkMode}>
                    Both LyricDisplay and OBS running on one computer. Perfect for most streaming setups.
                </SetupDescription>

                <StepsList>
                    <Step number={1} darkMode={darkMode}>
                        In OBS, click the <Strong>+</Strong> button under "Sources"
                    </Step>
                    <Step number={2} darkMode={darkMode}>
                        Choose <Strong>Browser</Strong> from the list
                    </Step>
                    <Step number={3} darkMode={darkMode}>
                        Name it <InlineCode darkMode={darkMode}>Lyrics Output 1</InlineCode>
                    </Step>
                    <Step number={4} darkMode={darkMode}>
                        Copy and paste this URL:
                        <URLBox darkMode={darkMode}>http://localhost:4000/#/output1</URLBox>
                    </Step>
                    <Step number={5} darkMode={darkMode}>
                        Set these values:
                        <SettingsGrid>
                            <SettingItem label="Width" value="1920" darkMode={darkMode} />
                            <SettingItem label="Height" value="1080" darkMode={darkMode} />
                            <SettingItem label="FPS" value="30" darkMode={darkMode} />
                        </SettingsGrid>
                    </Step>
                    <Step number={6} darkMode={darkMode}>
                        Check these two boxes:
                        <CheckboxList>
                            <CheckboxItem darkMode={darkMode}>Shutdown source when not visible</CheckboxItem>
                            <CheckboxItem darkMode={darkMode}>Refresh browser when scene becomes active</CheckboxItem>
                        </CheckboxList>
                        <div className="mt-3">
                            <TipBox darkMode={darkMode} type="warning">
                                <Strong>Note for Low-End PCs:</Strong> "Refresh browser when scene becomes active" may cause brief white flashes when switching scenes on computers with limited resources. If you experience this, uncheck this option.
                            </TipBox>
                        </div>
                    </Step>
                    <Step number={7} darkMode={darkMode}>
                        Click <Strong>OK</Strong>. The source is ready!
                    </Step>
                </StepsList>

                <TestingBox darkMode={darkMode}>
                    <Strong>Testing:</Strong> Load lyrics in LyricDisplay (Ctrl+O), click any line, and it appears in OBS!
                </TestingBox>
            </SetupOption>

            <SetupOption
                icon={<Network className="w-5 h-5" />}
                title="Network Setup"
                badge="Different Computers"
                badgeColor="blue"
                darkMode={darkMode}
            >
                <SetupDescription darkMode={darkMode}>
                    LyricDisplay on one computer, OBS on another. Both must be on the same network (connected to the same router/WiFi).
                </SetupDescription>

                <SectionHeader darkMode={darkMode}>On the LyricDisplay Computer:</SectionHeader>
                <StepsList>
                    <Step number={1} darkMode={darkMode}>
                        Your computer's network address is:
                        <URLBox darkMode={darkMode}>{localIP}</URLBox>
                        <Hint darkMode={darkMode}>This is like your computer's "phone number" on the network</Hint>
                    </Step>
                    <Step number={2} darkMode={darkMode}>
                        Make this address permanent (so it doesn't change):
                        <SubSteps darkMode={darkMode}>
                            <SubStep darkMode={darkMode}>Open Windows Settings → Network & Internet</SubStep>
                            <SubStep darkMode={darkMode}>Click your connection (Ethernet or Wi-Fi)</SubStep>
                            <SubStep darkMode={darkMode}>Click "Edit" next to IP assignment</SubStep>
                            <SubStep darkMode={darkMode}>Choose "Manual" and enter IP: <InlineCode darkMode={darkMode}>{localIP}</InlineCode></SubStep>
                            <SubStep darkMode={darkMode}>Subnet mask: <InlineCode darkMode={darkMode}>255.255.255.0</InlineCode></SubStep>
                            <SubStep darkMode={darkMode}>Gateway: Usually <InlineCode darkMode={darkMode}>192.168.1.1</InlineCode> or <InlineCode darkMode={darkMode}>192.168.0.1</InlineCode></SubStep>
                            <SubStep darkMode={darkMode}>Click Save</SubStep>
                        </SubSteps>
                    </Step>
                    <Step number={3} darkMode={darkMode}>
                        Allow LyricDisplay through your firewall:
                        <SubSteps darkMode={darkMode}>
                            <SubStep darkMode={darkMode}>Search "Windows Defender Firewall" in Start menu</SubStep>
                            <SubStep darkMode={darkMode}>Click "Allow an app through firewall"</SubStep>
                            <SubStep darkMode={darkMode}>Click "Change settings" then "Allow another app"</SubStep>
                            <SubStep darkMode={darkMode}>Browse to: <InlineCode darkMode={darkMode}>C:\Program Files\LyricDisplay\LyricDisplay.exe</InlineCode></SubStep>
                            <SubStep darkMode={darkMode}>Check both "Private" and "Public" boxes</SubStep>
                            <SubStep darkMode={darkMode}>Click Add</SubStep>
                        </SubSteps>
                        <Hint darkMode={darkMode}>This lets other computers talk to LyricDisplay</Hint>
                    </Step>
                </StepsList>

                <SectionHeader darkMode={darkMode}>On the OBS Computer:</SectionHeader>
                <StepsList>
                    <Step number={1} darkMode={darkMode}>
                        First, test the connection. Open any web browser and type:
                        <URLBox darkMode={darkMode}>http://{localIP}:4000</URLBox>
                        <Hint darkMode={darkMode}>If you see a page, it's working! Close the browser and continue.</Hint>
                    </Step>
                    <Step number={2} darkMode={darkMode}>
                        In OBS, add a <Strong>Browser</Strong> source (same as step 1 above)
                    </Step>
                    <Step number={3} darkMode={darkMode}>
                        Use this network URL instead:
                        <URLBox darkMode={darkMode}>http://{localIP}:4000/#/output1</URLBox>
                    </Step>
                    <Step number={4} darkMode={darkMode}>
                        Set Width: <InlineCode darkMode={darkMode}>1920</InlineCode>, Height: <InlineCode darkMode={darkMode}>1080</InlineCode>, FPS: <InlineCode darkMode={darkMode}>30</InlineCode>
                    </Step>
                    <Step number={5} darkMode={darkMode}>
                        Check the same two boxes as before, then click OK
                    </Step>
                </StepsList>
            </SetupOption>

            <TipBox darkMode={darkMode} type="info">
                <Strong>Browser Source Size:</Strong> Set the browser source size to match your stream resolution (e.g., 1920x1080 if that is your canvas resolution) to ensure lyrics display correctly.
            </TipBox>

            <TipBox darkMode={darkMode} type="pro">
                <Strong>Pro Tip:</Strong> Drag the browser source above your camera/video layers in OBS. The transparent background will let your video show through behind the lyrics!
            </TipBox>

            <TipBox darkMode={darkMode} type="info">
                <Strong>For Second Output:</Strong> Add another browser source with URL ending in <InlineCode darkMode={darkMode}>#/output2</InlineCode> for different styling or a second display.
            </TipBox>
        </div>
    );
}

// vMix Instructions
function VMixInstructions({ darkMode, localIP }) {
    return (
        <div className="space-y-6 pb-4">
            <IntroSection darkMode={darkMode}>
                LyricDisplay connects to vMix using a Web Browser input. This creates a transparent overlay layer that sits on top of your video production.
            </IntroSection>

            <SetupOption
                icon={<Monitor className="w-5 h-5" />}
                title="Same Computer Setup"
                badge="Easiest"
                badgeColor="green"
                darkMode={darkMode}
            >
                <SetupDescription darkMode={darkMode}>
                    Both LyricDisplay and vMix on the same computer. Great for single-computer production setups.
                </SetupDescription>

                <StepsList>
                    <Step number={1} darkMode={darkMode}>
                        In vMix, click <Strong>Add Input</Strong> at the bottom
                    </Step>
                    <Step number={2} darkMode={darkMode}>
                        Select <Strong>Web Browser</Strong> from the input types
                    </Step>
                    <Step number={3} darkMode={darkMode}>
                        Name it <InlineCode darkMode={darkMode}>Lyrics Output 1</InlineCode>
                    </Step>
                    <Step number={4} darkMode={darkMode}>
                        Enter this URL:
                        <URLBox darkMode={darkMode}>http://localhost:4000/#/output1</URLBox>
                    </Step>
                    <Step number={5} darkMode={darkMode}>
                        Set these values:
                        <SettingsGrid>
                            <SettingItem label="Width" value="1920" darkMode={darkMode} />
                            <SettingItem label="Height" value="1080" darkMode={darkMode} />
                            <SettingItem label="Frame Rate" value="30" darkMode={darkMode} />
                        </SettingsGrid>
                    </Step>
                    <Step number={6} darkMode={darkMode}>
                        Click <Strong>OK</Strong> to add the input
                    </Step>
                    <Step number={7} darkMode={darkMode}>
                        <Strong>Important:</Strong> Drag this input to an <Strong>Overlay layer</Strong> (numbered 1, 2, 3, or 4)
                        <Hint darkMode={darkMode}>Don't put it in the main preview! Overlay layers make it transparent and sit on top of your video.</Hint>
                    </Step>
                </StepsList>

                <TestingBox darkMode={darkMode}>
                    <Strong>Testing:</Strong> Load lyrics in LyricDisplay, click a line, and watch it appear in your vMix overlay!
                </TestingBox>
            </SetupOption>

            <SetupOption
                icon={<Network className="w-5 h-5" />}
                title="Network Setup"
                badge="Different Computers"
                badgeColor="blue"
                darkMode={darkMode}
            >
                <SetupDescription darkMode={darkMode}>
                    Control lyrics from one computer while vMix runs on another. Both computers must be connected to the same network.
                </SetupDescription>

                <SectionHeader darkMode={darkMode}>On the LyricDisplay Computer:</SectionHeader>
                <StepsList>
                    <Step number={1} darkMode={darkMode}>
                        Your network address is:
                        <URLBox darkMode={darkMode}>{localIP}</URLBox>
                    </Step>
                    <Step number={2} darkMode={darkMode}>
                        Make this address permanent:
                        <SubSteps darkMode={darkMode}>
                            <SubStep darkMode={darkMode}>Windows Settings → Network → IP settings → Edit</SubStep>
                            <SubStep darkMode={darkMode}>Choose "Manual"</SubStep>
                            <SubStep darkMode={darkMode}>IP address: <InlineCode darkMode={darkMode}>{localIP}</InlineCode></SubStep>
                            <SubStep darkMode={darkMode}>Subnet: <InlineCode darkMode={darkMode}>255.255.255.0</InlineCode></SubStep>
                            <SubStep darkMode={darkMode}>Gateway: <InlineCode darkMode={darkMode}>192.168.1.1</InlineCode> (or your router's address)</SubStep>
                            <SubStep darkMode={darkMode}>Save changes</SubStep>
                        </SubSteps>
                    </Step>
                    <Step number={3} darkMode={darkMode}>
                        Allow through Windows Firewall:
                        <SubSteps darkMode={darkMode}>
                            <SubStep darkMode={darkMode}>Search "Windows Defender Firewall"</SubStep>
                            <SubStep darkMode={darkMode}>Allow an app → Change settings → Allow another app</SubStep>
                            <SubStep darkMode={darkMode}>Add LyricDisplay.exe from Program Files</SubStep>
                            <SubStep darkMode={darkMode}>Check Private and Public boxes</SubStep>
                        </SubSteps>
                    </Step>
                </StepsList>

                <SectionHeader darkMode={darkMode}>On the vMix Computer:</SectionHeader>
                <StepsList>
                    <Step number={1} darkMode={darkMode}>
                        Test connection in a web browser first:
                        <URLBox darkMode={darkMode}>http://{localIP}:4000</URLBox>
                        <Hint darkMode={darkMode}>See a page? Great! Continue to next step.</Hint>
                    </Step>
                    <Step number={2} darkMode={darkMode}>
                        Add <Strong>Web Browser</Strong> input in vMix
                    </Step>
                    <Step number={3} darkMode={darkMode}>
                        Use this network URL:
                        <URLBox darkMode={darkMode}>http://{localIP}:4000/#/output1</URLBox>
                    </Step>
                    <Step number={4} darkMode={darkMode}>
                        Set Width/Height/Frame Rate (same as above)
                    </Step>
                    <Step number={5} darkMode={darkMode}>
                        Drag to an <Strong>Overlay layer</Strong> (not main preview!)
                    </Step>
                </StepsList>
            </SetupOption>

            <TipBox darkMode={darkMode} type="info">
                <Strong>Browser Source Size:</Strong> Set the browser source size to match your stream resolution (e.g., 1920x1080 if that is your canvas resolution) to ensure lyrics display correctly.
            </TipBox>

            <TipBox darkMode={darkMode} type="pro">
                <Strong>Quick Test:</Strong> Open a browser on the vMix computer and visit <InlineCode darkMode={darkMode}>http://{localIP}:4000</InlineCode>. If you see a page, your connection is ready!
            </TipBox>

            <TipBox darkMode={darkMode} type="info">
                <Strong>Overlay Layers Explained:</Strong> Layers 1-4 in vMix are special "overlay" positions that sit on top of your main video with transparency. Always use these for lyrics!
            </TipBox>
        </div>
    );
}

// Wirecast Instructions
function WirecastInstructions({ darkMode, localIP }) {
    return (
        <div className="space-y-6 pb-4">
            <IntroSection darkMode={darkMode}>
                LyricDisplay integrates with Wirecast using a Web Page source. This adds lyrics as a transparent layer that can appear across all shots or specific ones.
            </IntroSection>

            <SetupOption
                icon={<Monitor className="w-5 h-5" />}
                title="Same Computer Setup"
                badge="Easiest"
                badgeColor="green"
                darkMode={darkMode}
            >
                <SetupDescription darkMode={darkMode}>
                    Run both LyricDisplay and Wirecast on one computer. Ideal for smaller productions and streaming.
                </SetupDescription>

                <StepsList>
                    <Step number={1} darkMode={darkMode}>
                        In Wirecast, click the <Strong>+</Strong> button in shot layers
                    </Step>
                    <Step number={2} darkMode={darkMode}>
                        Select <Strong>Web Page</Strong> from source types
                    </Step>
                    <Step number={3} darkMode={darkMode}>
                        Name it <InlineCode darkMode={darkMode}>Lyrics Output 1</InlineCode>
                    </Step>
                    <Step number={4} darkMode={darkMode}>
                        Enter this URL:
                        <URLBox darkMode={darkMode}>http://localhost:4000/#/output1</URLBox>
                    </Step>
                    <Step number={5} darkMode={darkMode}>
                        Configure these settings:
                        <SettingsGrid>
                            <SettingItem label="Width" value="1920" darkMode={darkMode} />
                            <SettingItem label="Height" value="1080" darkMode={darkMode} />
                        </SettingsGrid>
                        <CheckboxList>
                            <CheckboxItem darkMode={darkMode}>
                                <Strong>Transparent Background</Strong> (Very important!)
                            </CheckboxItem>
                        </CheckboxList>
                    </Step>
                    <Step number={6} darkMode={darkMode}>
                        Click <Strong>OK</Strong> to add the source
                    </Step>
                    <Step number={7} darkMode={darkMode}>
                        Choose where lyrics appear:
                        <ChoiceBox darkMode={darkMode}>
                            <Choice darkMode={darkMode}>
                                <Strong>Master Layer:</Strong> Lyrics show on all shots (recommended for worship services)
                            </Choice>
                            <Choice darkMode={darkMode}>
                                <Strong>Shot Layer:</Strong> Lyrics only on specific shots you choose
                            </Choice>
                        </ChoiceBox>
                        <Hint darkMode={darkMode}>Drag the source to your chosen layer position</Hint>
                    </Step>
                </StepsList>

                <TestingBox darkMode={darkMode}>
                    <Strong>Testing:</Strong> Load lyrics in LyricDisplay, click any line, and see it in Wirecast preview and program!
                </TestingBox>
            </SetupOption>

            <SetupOption
                icon={<Network className="w-5 h-5" />}
                title="Network Setup"
                badge="Different Computers"
                badgeColor="blue"
                darkMode={darkMode}
            >
                <SetupDescription darkMode={darkMode}>
                    Control lyrics from a separate computer. Perfect for larger productions with dedicated operators.
                </SetupDescription>

                <SectionHeader darkMode={darkMode}>On the LyricDisplay Computer:</SectionHeader>
                <StepsList>
                    <Step number={1} darkMode={darkMode}>
                        Your network address:
                        <URLBox darkMode={darkMode}>{localIP}</URLBox>
                    </Step>
                    <Step number={2} darkMode={darkMode}>
                        Set a permanent IP address:
                        <SubSteps darkMode={darkMode}>
                            <SubStep darkMode={darkMode}>Open Network Settings</SubStep>
                            <SubStep darkMode={darkMode}>Change adapter options → Right-click connection → Properties</SubStep>
                            <SubStep darkMode={darkMode}>IPv4 → Properties → "Use the following IP address"</SubStep>
                            <SubStep darkMode={darkMode}>IP: <InlineCode darkMode={darkMode}>{localIP}</InlineCode></SubStep>
                            <SubStep darkMode={darkMode}>Subnet: <InlineCode darkMode={darkMode}>255.255.255.0</InlineCode></SubStep>
                            <SubStep darkMode={darkMode}>Gateway: <InlineCode darkMode={darkMode}>192.168.1.1</InlineCode> (usually)</SubStep>
                        </SubSteps>
                    </Step>
                    <Step number={3} darkMode={darkMode}>
                        Configure firewall:
                        <SubSteps darkMode={darkMode}>
                            <SubStep darkMode={darkMode}>Search "Windows Defender Firewall"</SubStep>
                            <SubStep darkMode={darkMode}>Allow an app → Add LyricDisplay.exe</SubStep>
                            <SubStep darkMode={darkMode}>Check Private and Public boxes</SubStep>
                        </SubSteps>
                    </Step>
                </StepsList>

                <SectionHeader darkMode={darkMode}>On the Wirecast Computer:</SectionHeader>
                <StepsList>
                    <Step number={1} darkMode={darkMode}>
                        Test in browser:
                        <URLBox darkMode={darkMode}>http://{localIP}:4000</URLBox>
                        <Hint darkMode={darkMode}>Page loads? Perfect! Move to next step.</Hint>
                    </Step>
                    <Step number={2} darkMode={darkMode}>
                        Add <Strong>Web Page</Strong> source in Wirecast
                    </Step>
                    <Step number={3} darkMode={darkMode}>
                        Use network URL:
                        <URLBox darkMode={darkMode}>http://{localIP}:4000/#/output1</URLBox>
                    </Step>
                    <Step number={4} darkMode={darkMode}>
                        Enable <Strong>Transparent Background</Strong> checkbox
                    </Step>
                    <Step number={5} darkMode={darkMode}>
                        Assign to Master or Shot layer
                    </Step>
                </StepsList>
            </SetupOption>

            <TipBox darkMode={darkMode} type="info">
                <Strong>Browser Source Size:</Strong> Set the browser source size to match your stream resolution (e.g., 1920x1080 if that is your canvas resolution) to ensure lyrics display correctly.
            </TipBox>

            <TipBox darkMode={darkMode} type="warning">
                <Strong>Production Tip:</Strong> Use <Strong>Ethernet cables</Strong> for both computers, not Wi-Fi. Wired connections are much more reliable for live production!
            </TipBox>

            <TipBox darkMode={darkMode} type="pro">
                <Strong>Layer Strategy:</Strong> Use Master Layer for continuous display throughout service, or Shot Layer if you only want lyrics during specific camera angles.
            </TipBox>
        </div>
    );
}

function IntroSection({ children, darkMode }) {
    return (
        <div className={`p-3 rounded-lg text-sm leading-relaxed ${darkMode ? 'bg-blue-500/10 text-blue-300 border border-blue-500/30' : 'bg-blue-50 text-blue-800 border border-blue-200'}`}>
            {children}
        </div>
    );
}

function SetupOption({ icon, title, badge, badgeColor, children, darkMode }) {
    const badgeColors = {
        green: darkMode ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-green-50 text-green-700 border-green-200',
        blue: darkMode ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-blue-50 text-blue-700 border-blue-200'
    };

    return (
        <div className={`rounded-lg border p-4 ${darkMode ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
            <div className="flex items-center gap-3 mb-4">
                <div className={`p-2 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-white'}`}>
                    {icon}
                </div>
                <div className="flex-1">
                    <h3 className={`font-semibold text-base ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                        {title}
                    </h3>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${badgeColors[badgeColor]}`}>
                    {badge}
                </span>
            </div>
            {children}
        </div>
    );
}

function SetupDescription({ children, darkMode }) {
    return (
        <p className={`text-xs mb-4 leading-relaxed ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            {children}
        </p>
    );
}

function SectionHeader({ children, darkMode }) {
    return (
        <h4 className={`text-sm font-semibold mb-3 mt-4 ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
            {children}
        </h4>
    );
}

function StepsList({ children }) {
    return <div className="space-y-3">{children}</div>;
}

function Step({ number, children, darkMode }) {
    return (
        <div className="flex gap-3">
            <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${darkMode ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-100 text-blue-700'}`}>
                {number}
            </div>
            <div className={`flex-1 pt-0.5 text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                {children}
            </div>
        </div>
    );
}

function SubSteps({ children, darkMode }) {
    return (
        <div className={`mt-2 ml-2 pl-3 border-l-2 space-y-1.5 ${darkMode ? 'border-gray-700' : 'border-gray-300'}`}>
            {children}
        </div>
    );
}

function SubStep({ children, darkMode }) {
    return (
        <div className="flex gap-2 items-start">
            <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${darkMode ? 'bg-gray-500' : 'bg-gray-400'}`} />
            <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                {children}
            </span>
        </div>
    );
}

function URLBox({ children, darkMode }) {
    const textRef = React.useRef(null);
    const [copied, setCopied] = React.useState(false);

    const handleCopy = () => {
        const textContent = textRef.current?.textContent || '';
        navigator.clipboard.writeText(textContent).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }).catch((err) => {
            console.error('Failed to copy:', err);
        });
    };

    return (
        <div className={`mt-2 p-2.5 rounded-lg font-mono text-xs flex items-center justify-between gap-2 ${darkMode ? 'bg-gray-800 text-blue-300 border border-gray-700' : 'bg-gray-100 text-blue-700 border border-gray-200'}`}>
            <span ref={textRef} className="break-all flex-1">{children}</span>
            <button
                onClick={handleCopy}
                className={`flex-shrink-0 p-1.5 rounded transition-all ${copied
                    ? darkMode ? 'bg-green-600 text-white' : 'bg-green-500 text-white'
                    : darkMode ? 'hover:bg-gray-700 text-gray-400 hover:text-gray-200' : 'hover:bg-gray-200 text-gray-500 hover:text-gray-700'
                    }`}
                title={copied ? 'Copied!' : 'Copy to clipboard'}
            >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
        </div>
    );
}

function SettingsGrid({ children }) {
    return <div className="mt-2 grid grid-cols-3 gap-2">{children}</div>;
}

function SettingItem({ label, value, darkMode }) {
    return (
        <div className={`p-2 rounded text-center ${darkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
            <div className={`text-[10px] font-semibold mb-0.5 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                {label}
            </div>
            <div className={`text-xs font-mono ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                {value}
            </div>
        </div>
    );
}

function CheckboxList({ children }) {
    return <div className="mt-2 space-y-1.5">{children}</div>;
}

function CheckboxItem({ children, darkMode }) {
    return (
        <div className="flex gap-2 items-start">
            <Check className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${darkMode ? 'text-green-400' : 'text-green-600'}`} />
            <span className={`text-xs ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                {children}
            </span>
        </div>
    );
}

function ChoiceBox({ children, darkMode }) {
    return (
        <div className={`mt-2 p-2.5 rounded-lg space-y-2 ${darkMode ? 'bg-gray-800/50 border border-gray-700' : 'bg-white border border-gray-200'}`}>
            {children}
        </div>
    );
}

function Choice({ children, darkMode }) {
    return (
        <div className={`text-xs ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
            {children}
        </div>
    );
}

function Hint({ children, darkMode }) {
    return (
        <div className={`mt-2 text-xs italic ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
            {children}
        </div>
    );
}

function TestingBox({ children, darkMode }) {
    return (
        <div className={`mt-4 p-3 rounded-lg border ${darkMode ? 'bg-green-500/10 border-green-500/30 text-green-300' : 'bg-green-50 border-green-200 text-green-800'}`}>
            <div className="text-xs leading-relaxed">
                {children}
            </div>
        </div>
    );
}

function TipBox({ children, darkMode, type = 'pro' }) {
    const styles = {
        pro: darkMode
            ? 'bg-purple-500/10 border-purple-500/30 text-purple-300'
            : 'bg-purple-50 border-purple-200 text-purple-800',
        info: darkMode
            ? 'bg-blue-500/10 border-blue-500/30 text-blue-300'
            : 'bg-blue-50 border-blue-200 text-blue-800',
        warning: darkMode
            ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
            : 'bg-amber-50 border-amber-200 text-amber-800'
    };

    const icons = {
        pro: '💡',
        info: 'ℹ️',
        warning: '⚠️'
    };

    return (
        <div className={`p-3 rounded-lg border flex gap-2.5 ${styles[type]}`}>
            <span className="text-base flex-shrink-0">{icons[type]}</span>
            <p className="text-xs leading-relaxed">
                {children}
            </p>
        </div>
    );
}

function Strong({ children }) {
    return <strong className="font-semibold">{children}</strong>;
}

function InlineCode({ children, darkMode }) {
    return (
        <code className={`px-1.5 py-0.5 rounded text-xs font-mono ${darkMode ? 'bg-gray-700 text-blue-300' : 'bg-gray-200 text-blue-700'}`}>
            {children}
        </code>
    );
}