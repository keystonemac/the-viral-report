import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Linking,
  Platform,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as DocumentPicker from "expo-document-picker";
import * as Haptics from "expo-haptics";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Paths, File as ExpoFile } from "expo-file-system";
import * as WebBrowser from "expo-web-browser";
import {
  Upload,
  Zap,
  Music,
  TrendingUp,
  Globe,
  ExternalLink,
  Compass,
  ChevronRight,
  X,
  CheckCircle,
  BarChart3,
  Sparkles,
  FileDown,
  FileText,
  ShieldBan,
  Plus,
  Trash2,
  UserX,
  Building2,
  Search,
  Lock,
  Volume2,
  Disc,
} from "lucide-react-native";
import Colors from "@/constants/colors";
import { MARKETS, Market, MAJOR_LABELS, MAJOR_ARTISTS } from "@/constants/markets";
import { parseChartexCSV, RawSoundEntry, ReportMode } from "@/utils/csv-parser";
import {
  generateReport,
  ViralReport,
  ReportSound,
  formatCreates,
} from "@/utils/report-generator";
import { generateReportHTML, openReportInNewWindow, generateReportPlaintext } from "@/utils/pdf-export";

type UploadState = Record<string, { loaded: boolean; count: number }>;

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [report, setReport] = useState<ViralReport | null>(null);
  const [reportMode, setReportMode] = useState<ReportMode>("sounds");
  const [soundsUploads, setSoundsUploads] = useState<UploadState>({});
  const [soundsEntries, setSoundsEntries] = useState<RawSoundEntry[]>([]);
  const [songsUploads, setSongsUploads] = useState<UploadState>({});
  const [songsEntries, setSongsEntries] = useState<RawSoundEntry[]>([]);
  const [generating, setGenerating] = useState(false);
  const [expandedSound, setExpandedSound] = useState<string | null>(null);
  const [excludedSounds, setExcludedSounds] = useState<Set<string>>(new Set());
  const [showBlocklist, setShowBlocklist] = useState(false);
  const [blockedArtists, setBlockedArtists] = useState<string[]>([]);
  const [blockedLabels, setBlockedLabels] = useState<string[]>([]);
  const [newArtist, setNewArtist] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [blocklistTab, setBlocklistTab] = useState<"artists" | "labels">("artists");
  const [blockSearch, setBlockSearch] = useState("");
  const [soundComments, setSoundComments] = useState<Record<string, string>>({});

  const activeUploads = reportMode === "sounds" ? soundsUploads : songsUploads;
  const activeEntries = reportMode === "sounds" ? soundsEntries : songsEntries;

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    AsyncStorage.getItem("blockedArtists").then((val) => {
      if (val) setBlockedArtists(JSON.parse(val));
    });
    AsyncStorage.getItem("blockedLabels").then((val) => {
      if (val) setBlockedLabels(JSON.parse(val));
    });
  }, []);

  const saveBlockedArtists = useCallback((list: string[]) => {
    setBlockedArtists(list);
    AsyncStorage.setItem("blockedArtists", JSON.stringify(list));
  }, []);

  const saveBlockedLabels = useCallback((list: string[]) => {
    setBlockedLabels(list);
    AsyncStorage.setItem("blockedLabels", JSON.stringify(list));
  }, []);

  const addBlockedArtist = useCallback(() => {
    const trimmed = newArtist.trim();
    if (!trimmed) return;
    if (blockedArtists.some((a) => a.toLowerCase() === trimmed.toLowerCase())) {
      Alert.alert("Duplicate", "This artist is already in your block list.");
      return;
    }
    saveBlockedArtists([...blockedArtists, trimmed]);
    setNewArtist("");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [newArtist, blockedArtists, saveBlockedArtists]);

  const addBlockedLabel = useCallback(() => {
    const trimmed = newLabel.trim();
    if (!trimmed) return;
    if (blockedLabels.some((l) => l.toLowerCase() === trimmed.toLowerCase())) {
      Alert.alert("Duplicate", "This label is already in your block list.");
      return;
    }
    saveBlockedLabels([...blockedLabels, trimmed]);
    setNewLabel("");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [newLabel, blockedLabels, saveBlockedLabels]);

  const removeBlockedArtist = useCallback((index: number) => {
    const updated = blockedArtists.filter((_, i) => i !== index);
    saveBlockedArtists(updated);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [blockedArtists, saveBlockedArtists]);

  const removeBlockedLabel = useCallback((index: number) => {
    const updated = blockedLabels.filter((_, i) => i !== index);
    saveBlockedLabels(updated);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [blockedLabels, saveBlockedLabels]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  useEffect(() => {
    if (Object.keys(activeUploads).length > 0 && !report) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.03,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1200,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [activeUploads, report, pulseAnim]);

  const handlePickCSV = useCallback(
    async (market: Market) => {
      try {
        const result = await DocumentPicker.getDocumentAsync({
          type: ["text/csv", "text/comma-separated-values", "application/csv", "*/*"],
          copyToCacheDirectory: true,
        });

        if (result.canceled) return;

        const file = result.assets[0];
        console.log(`[${reportMode}] Picked file for ${market.id}:`, file.name);

        const response = await fetch(file.uri);
        const content = await response.text();

        const entries = parseChartexCSV(content, market.id);
        console.log(`[${reportMode}] Parsed ${entries.length} entries for ${market.id}`);

        if (entries.length === 0) {
          Alert.alert(
            "No Data Found",
            "Couldn't parse any entries from this CSV. Make sure it's exported from Chartex with the correct filters."
          );
          return;
        }

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        const setEntriesFn = reportMode === "sounds" ? setSoundsEntries : setSongsEntries;
        const setUploadsFn = reportMode === "sounds" ? setSoundsUploads : setSongsUploads;

        setEntriesFn((prev) => {
          const withoutMarket = prev.filter((e) => e.market !== market.id);
          return [...withoutMarket, ...entries];
        });

        setUploadsFn((prev) => ({
          ...prev,
          [market.id]: { loaded: true, count: entries.length },
        }));

        setReport(null);
      } catch (err) {
        console.error("Error picking CSV:", err);
        Alert.alert("Error", "Failed to read the CSV file. Please try again.");
      }
    },
    [reportMode]
  );

  const handleGenerate = useCallback(async () => {
    if (activeEntries.length === 0) {
      Alert.alert("No Data", "Please upload at least one market CSV first.");
      return;
    }

    setGenerating(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    await new Promise((r) => setTimeout(r, 800));

    const result = generateReport(activeEntries, 0, 100000, blockedArtists, blockedLabels, reportMode);
    setReport(result);
    setGenerating(false);

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [activeEntries, blockedArtists, blockedLabels, reportMode]);

  const [exporting, setExporting] = useState(false);
  const [exportingTxt, setExportingTxt] = useState(false);

  const getSoundCommentKey = useCallback((sound: ReportSound) => {
    const name = (sound.songTitle || sound.soundName).toLowerCase().replace(/[^a-z0-9]/g, "");
    const artist = sound.artist.toLowerCase().replace(/[^a-z0-9]/g, "");
    return `${name}-${artist}`;
  }, []);

  const handleCommentChange = useCallback((sound: ReportSound, text: string) => {
    const key = getSoundCommentKey(sound);
    setSoundComments((prev) => ({ ...prev, [key]: text }));
  }, [getSoundCommentKey]);

  const getFilteredReport = useCallback((): ViralReport | null => {
    if (!report) return null;
    const filtered = report.sounds
      .filter((s) => !excludedSounds.has(s.id))
      .map((s) => ({
        ...s,
        comment: soundComments[getSoundCommentKey(s)] || "",
      }));
    return {
      ...report,
      sounds: filtered,
      totalSounds: filtered.length,
    };
  }, [report, excludedSounds, soundComments, getSoundCommentKey]);

  const handleExportPDF = useCallback(async () => {
    const filteredReport = getFilteredReport();
    if (!filteredReport) return;
    setExporting(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const html = generateReportHTML(filteredReport);

      if (Platform.OS === "web") {
        openReportInNewWindow(html);
      } else {
        const result = await Print.printToFileAsync({ html, base64: false });
        const uri = result?.uri;
        console.log("PDF generated at:", uri);
        if (uri) {
          const canShare = await Sharing.isAvailableAsync();
          if (canShare) {
            await Sharing.shareAsync(uri, {
              mimeType: "application/pdf",
              dialogTitle: "Save The Viral Report",
              UTI: "com.adobe.pdf",
            });
          } else {
            Alert.alert("PDF Saved", `Report saved to: ${uri}`);
          }
        } else {
          Alert.alert("Export Failed", "Could not generate the PDF file.");
        }
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      console.error("PDF export error:", err);
      Alert.alert("Export Failed", "Could not generate the PDF. Please try again.");
    } finally {
      setExporting(false);
    }
  }, [getFilteredReport]);

  const handleExportPlaintext = useCallback(async () => {
    const filteredReport = getFilteredReport();
    if (!filteredReport) return;
    setExportingTxt(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const text = generateReportPlaintext(filteredReport);

      if (Platform.OS === "web") {
        const blob = new Blob([text], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `the-viral-report-${new Date().toISOString().slice(0, 10)}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        const fileName = `the-viral-report-${new Date().toISOString().slice(0, 10)}.txt`;
        const file = new ExpoFile(Paths.cache, fileName);
        file.write(text);
        console.log("Plaintext report saved at:", file.uri);
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(file.uri, {
            mimeType: "text/plain",
            dialogTitle: "Save The Viral Report (Text)",
            UTI: "public.plain-text",
          });
        } else {
          Alert.alert("Report Saved", `Plaintext report saved.`);
        }
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      console.error("Plaintext export error:", err);
      Alert.alert("Export Failed", "Could not generate the text report. Please try again.");
    } finally {
      setExportingTxt(false);
    }
  }, [getFilteredReport]);

  const handleReset = useCallback(() => {
    if (reportMode === "sounds") {
      setSoundsUploads({});
      setSoundsEntries([]);
    } else {
      setSongsUploads({});
      setSongsEntries([]);
    }
    setReport(null);
    setExpandedSound(null);
    setSoundComments({});
  }, [reportMode]);

  const openTikTok = useCallback((url: string) => {
    if (url && url.startsWith("http")) {
      Linking.openURL(url);
    } else if (url) {
      Linking.openURL(`https://www.tiktok.com/music/${url}`);
    }
  }, []);

  const loadedCount = Object.values(activeUploads).filter((u) => u.loaded).length;
  const canGenerate = loadedCount > 0;
  const isSongs = reportMode === "songs";
  const itemLabelPlural = isSongs ? "songs" : "sounds";
  const itemLabelCap = isSongs ? "Song" : "Sound";
  const itemLabelPluralCap = isSongs ? "Songs" : "Sounds";

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={["#12121F", "#0A0A0F", "#0A0A0F"]}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          style={[
            styles.header,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <View style={styles.logoRow}>
            <View style={styles.logoIcon}>
              <Zap size={20} color={Colors.accent} fill={Colors.accent} />
            </View>
            <Text style={styles.logoText}>THE VIRAL REPORT</Text>
          </View>
          <Text style={styles.subtitle}>
            TikTok Trending {itemLabelPluralCap} · 24HR Report
          </Text>
          <Text style={styles.date}>
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </Text>
        </Animated.View>

        {!report && (
          <View style={styles.modeToggleRow}>
            <TouchableOpacity
              style={[
                styles.modeToggleBtn,
                reportMode === "sounds" && styles.modeToggleBtnActive,
              ]}
              onPress={() => {
                setReportMode("sounds");
                setReport(null);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              activeOpacity={0.7}
              testID="mode-toggle-sounds"
            >
              <Volume2 size={16} color={reportMode === "sounds" ? Colors.accent : Colors.textMuted} />
              <Text style={[styles.modeToggleText, reportMode === "sounds" && styles.modeToggleTextActive]}>
                Sounds
              </Text>
              {Object.keys(soundsUploads).length > 0 && (
                <View style={[styles.modeBadge, reportMode === "sounds" && styles.modeBadgeActive]}>
                  <Text style={[styles.modeBadgeText, reportMode === "sounds" && styles.modeBadgeTextActive]}>
                    {Object.keys(soundsUploads).length}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.modeToggleBtn,
                reportMode === "songs" && styles.modeToggleBtnActive,
              ]}
              onPress={() => {
                setReportMode("songs");
                setReport(null);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              activeOpacity={0.7}
              testID="mode-toggle-songs"
            >
              <Disc size={16} color={reportMode === "songs" ? Colors.accent : Colors.textMuted} />
              <Text style={[styles.modeToggleText, reportMode === "songs" && styles.modeToggleTextActive]}>
                Songs
              </Text>
              {Object.keys(songsUploads).length > 0 && (
                <View style={[styles.modeBadge, reportMode === "songs" && styles.modeBadgeActive]}>
                  <Text style={[styles.modeBadgeText, reportMode === "songs" && styles.modeBadgeTextActive]}>
                    {Object.keys(songsUploads).length}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        )}

        {!report && (
          <TouchableOpacity
            style={styles.chartexButton}
            activeOpacity={0.8}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              WebBrowser.openBrowserAsync("https://chartex.com/", {
                presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
              });
            }}
          >
            <Compass size={18} color="#fff" />
            <Text style={styles.chartexButtonText}>Browse Chartex</Text>
            <ExternalLink size={14} color="rgba(255,255,255,0.6)" />
          </TouchableOpacity>
        )}

        {!report && (
          <Animated.View
            style={{
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            }}
          >
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Globe size={16} color={Colors.textSecondary} />
                <Text style={styles.sectionTitle}>MARKET DATA</Text>
              </View>
              <Text style={styles.sectionDesc}>
                Export 24HR {isSongs ? "Songs" : "Sounds"} CSVs from Chartex{isSongs ? "" : " with 0–50K creates filter"} for each market
              </Text>

              {MARKETS.map((market) => {
                const uploaded = activeUploads[market.id];
                return (
                  <TouchableOpacity
                    key={market.id}
                    style={[
                      styles.marketCard,
                      uploaded && styles.marketCardLoaded,
                      uploaded && { borderColor: market.color + "40" },
                    ]}
                    onPress={() => handlePickCSV(market)}
                    activeOpacity={0.7}
                    testID={`market-${market.id}`}
                  >
                    <View style={styles.marketLeft}>
                      <Text style={styles.marketFlag}>{market.flag}</Text>
                      <View>
                        <Text style={styles.marketLabel}>{market.label}</Text>
                        {uploaded ? (
                          <Text style={[styles.marketStatus, { color: market.color }]}>
                            {uploaded.count} {itemLabelPlural} loaded
                          </Text>
                        ) : (
                          <Text style={styles.marketStatusEmpty}>
                            Tap to upload CSV
                          </Text>
                        )}
                      </View>
                    </View>
                    {uploaded ? (
                      <CheckCircle size={20} color={market.color} />
                    ) : (
                      <Upload size={18} color={Colors.textMuted} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            <Animated.View style={{ transform: [{ scale: canGenerate ? pulseAnim : 1 }] }}>
              <TouchableOpacity
                style={[
                  styles.generateBtn,
                  !canGenerate && styles.generateBtnDisabled,
                ]}
                onPress={handleGenerate}
                disabled={!canGenerate || generating}
                activeOpacity={0.8}
                testID="generate-report"
              >
                <LinearGradient
                  colors={
                    canGenerate
                      ? [Colors.accent, "#E02050"]
                      : ["#1A1A25", "#1A1A25"]
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.generateGradient}
                >
                  {generating ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Sparkles size={20} color={canGenerate ? "#fff" : Colors.textMuted} />
                  )}
                  <Text
                    style={[
                      styles.generateText,
                      !canGenerate && styles.generateTextDisabled,
                    ]}
                  >
                    {generating
                      ? "Analyzing..."
                      : `Generate ${itemLabelCap} Report${loadedCount > 0 ? ` (${loadedCount} market${loadedCount > 1 ? "s" : ""})` : ""}`}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          </Animated.View>
        )}

        {report && (
          <View>
            <View style={styles.reportHeader}>
              <View>
                <Text style={styles.reportTitle}>
                  🔥 {report.reportMode === "songs" ? "Songs" : "Sounds"} Report
                </Text>
                <Text style={styles.reportSubtitle}>
                  {report.totalSounds} trending {report.reportMode === "songs" ? "songs" : "sounds"} · {Object.keys(report.marketBreakdown).length} markets
                </Text>
              </View>
              <View style={styles.reportActions}>
                <TouchableOpacity
                  onPress={handleExportPlaintext}
                  style={styles.txtBtn}
                  activeOpacity={0.7}
                  disabled={exportingTxt}
                  testID="export-txt"
                >
                  {exportingTxt ? (
                    <ActivityIndicator color="#8899aa" size="small" />
                  ) : (
                    <FileText size={18} color="#8899aa" />
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleExportPDF}
                  style={styles.pdfBtn}
                  activeOpacity={0.7}
                  disabled={exporting}
                  testID="export-pdf"
                >
                  {exporting ? (
                    <ActivityIndicator color={Colors.accent} size="small" />
                  ) : (
                    <FileDown size={18} color={Colors.accent} />
                  )}
                </TouchableOpacity>
                <TouchableOpacity onPress={handleReset} style={styles.resetBtn}>
                  <X size={18} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.statsRow}>
              {Object.entries(report.marketBreakdown).map(([marketId, count]) => {
                const market = MARKETS.find((m) => m.id === marketId);
                if (!market) return null;
                return (
                  <View
                    key={marketId}
                    style={[styles.statChip, { backgroundColor: market.color + "18" }]}
                  >
                    <Text style={styles.statFlag}>{market.flag}</Text>
                    <Text style={[styles.statCount, { color: market.color }]}>
                      {count}
                    </Text>
                  </View>
                );
              })}
            </View>

            {report.sounds.length === 0 && (
              <View style={styles.emptyReport}>
                <BarChart3 size={40} color={Colors.textMuted} />
                <Text style={styles.emptyText}>
                  No {report.reportMode === "songs" ? "songs" : "sounds"} match the filter for independent artists.
                </Text>
                <Text style={styles.emptySubtext}>
                  Try adjusting your Chartex filters or uploading more markets.
                </Text>
              </View>
            )}

            {Object.keys(report.marketBreakdown).length > 1 ? (
              Object.keys(report.marketBreakdown).map((marketId) => {
                const market = MARKETS.find((m) => m.id === marketId);
                if (!market) return null;
                const marketSounds = report.sounds
                  .filter((s) => s.markets.includes(marketId))
                  .sort((a, b) => (b.creates24h || b.createsTotal) - (a.creates24h || a.createsTotal));
                if (marketSounds.length === 0) return null;
                return (
                  <View key={marketId} style={styles.marketSection}>
                    <View style={[styles.marketSectionHeader, { borderLeftColor: market.color }]}>
                      <Text style={styles.marketSectionFlag}>{market.flag}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.marketSectionTitle}>{market.label}</Text>
                        <Text style={[styles.marketSectionCount, { color: market.color }]}>
                          {marketSounds.length} {report.reportMode === "songs" ? "song" : "sound"}{marketSounds.length !== 1 ? "s" : ""}
                        </Text>
                      </View>
                    </View>
                    {marketSounds.map((sound, index) => (
                      <SoundCard
                        key={`${marketId}-${sound.id}`}
                        sound={{ ...sound, rank: index + 1 }}
                        index={index}
                        expanded={expandedSound === `${marketId}-${sound.id}`}
                        excluded={excludedSounds.has(sound.id)}
                        comment={soundComments[getSoundCommentKey(sound)] || ""}
                        onCommentChange={(text) => handleCommentChange(sound, text)}
                        onToggle={() =>
                          setExpandedSound(expandedSound === `${marketId}-${sound.id}` ? null : `${marketId}-${sound.id}`)
                        }
                        onOpenTikTok={openTikTok}
                        onBlockArtist={(artist) => {
                          if (blockedArtists.some((a) => a.toLowerCase() === artist.toLowerCase())) {
                            Alert.alert("Already Blocked", `${artist} is already in your block list.`);
                            return;
                          }
                          saveBlockedArtists([...blockedArtists, artist]);
                          setExcludedSounds((prev) => {
                            const next = new Set(prev);
                            next.add(sound.id);
                            return next;
                          });
                          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                          Alert.alert("Blocked", `${artist} added to your block list.`);
                        }}
                        isSongs={report.reportMode === "songs"}
                        onExclude={() => {
                          setExcludedSounds((prev) => {
                            const next = new Set(prev);
                            if (next.has(sound.id)) {
                              next.delete(sound.id);
                            } else {
                              next.add(sound.id);
                            }
                            return next;
                          });
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }}
                      />
                    ))}
                  </View>
                );
              })
            ) : (
              report.sounds.map((sound, index) => (
                <SoundCard
                  key={sound.id}
                  sound={sound}
                  index={index}
                  expanded={expandedSound === sound.id}
                  excluded={excludedSounds.has(sound.id)}
                  comment={soundComments[getSoundCommentKey(sound)] || ""}
                  onCommentChange={(text) => handleCommentChange(sound, text)}
                  onToggle={() =>
                    setExpandedSound(expandedSound === sound.id ? null : sound.id)
                  }
                  onOpenTikTok={openTikTok}
                  onBlockArtist={(artist) => {
                    if (blockedArtists.some((a) => a.toLowerCase() === artist.toLowerCase())) {
                      Alert.alert("Already Blocked", `${artist} is already in your block list.`);
                      return;
                    }
                    saveBlockedArtists([...blockedArtists, artist]);
                    setExcludedSounds((prev) => {
                      const next = new Set(prev);
                      next.add(sound.id);
                      return next;
                    });
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    Alert.alert("Blocked", `${artist} added to your block list.`);
                  }}
                  isSongs={report.reportMode === "songs"}
                  onExclude={() => {
                    setExcludedSounds((prev) => {
                      const next = new Set(prev);
                      if (next.has(sound.id)) {
                        next.delete(sound.id);
                      } else {
                        next.add(sound.id);
                      }
                      return next;
                    });
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                />
              ))
            )}
          </View>
        )}
      </ScrollView>

      <TouchableOpacity
        style={[styles.blocklistFab, { bottom: insets.bottom + 20 }]}
        onPress={() => setShowBlocklist(true)}
        activeOpacity={0.8}
        testID="open-blocklist"
      >
        <ShieldBan size={20} color="#fff" />
        {(blockedArtists.length + blockedLabels.length) > 0 && (
          <View style={styles.fabBadge}>
            <Text style={styles.fabBadgeText}>{blockedArtists.length + blockedLabels.length}</Text>
          </View>
        )}
      </TouchableOpacity>

      <Modal
        visible={showBlocklist}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowBlocklist(false)}
      >
        <View style={[styles.modalContainer, { paddingTop: Platform.OS === "ios" ? 20 : insets.top }]}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Block List</Text>
              <Text style={styles.modalSubtitle}>
                {blocklistTab === "artists"
                  ? `${MAJOR_ARTISTS.length} built-in + ${blockedArtists.length} custom artists`
                  : `${MAJOR_LABELS.length} built-in + ${blockedLabels.length} custom labels`}
              </Text>
            </View>
            <TouchableOpacity onPress={() => { setShowBlocklist(false); setBlockSearch(""); }} style={styles.modalClose}>
              <X size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.tabRow}>
            <TouchableOpacity
              style={[styles.tab, blocklistTab === "artists" && styles.tabActive]}
              onPress={() => { setBlocklistTab("artists"); setBlockSearch(""); }}
              activeOpacity={0.7}
            >
              <UserX size={14} color={blocklistTab === "artists" ? Colors.accent : Colors.textMuted} />
              <Text style={[styles.tabText, blocklistTab === "artists" && styles.tabTextActive]}>
                Artists ({MAJOR_ARTISTS.length + blockedArtists.length})
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, blocklistTab === "labels" && styles.tabActive]}
              onPress={() => { setBlocklistTab("labels"); setBlockSearch(""); }}
              activeOpacity={0.7}
            >
              <Building2 size={14} color={blocklistTab === "labels" ? Colors.accent : Colors.textMuted} />
              <Text style={[styles.tabText, blocklistTab === "labels" && styles.tabTextActive]}>
                Labels ({MAJOR_LABELS.length + blockedLabels.length})
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.searchRow}>
            <View style={styles.searchBar}>
              <Search size={16} color={Colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder={blocklistTab === "artists" ? "Search artists..." : "Search labels..."}
                placeholderTextColor={Colors.textMuted}
                value={blockSearch}
                onChangeText={setBlockSearch}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {blockSearch.length > 0 && (
                <TouchableOpacity onPress={() => setBlockSearch("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <X size={14} color={Colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          <View style={styles.addRow}>
            <TextInput
              style={styles.addInput}
              placeholder={blocklistTab === "artists" ? "Add custom artist..." : "Add custom label..."}
              placeholderTextColor={Colors.textMuted}
              value={blocklistTab === "artists" ? newArtist : newLabel}
              onChangeText={blocklistTab === "artists" ? setNewArtist : setNewLabel}
              onSubmitEditing={blocklistTab === "artists" ? addBlockedArtist : addBlockedLabel}
              returnKeyType="done"
              autoCapitalize="words"
            />
            <TouchableOpacity
              style={styles.addBtn}
              onPress={blocklistTab === "artists" ? addBlockedArtist : addBlockedLabel}
              activeOpacity={0.7}
            >
              <Plus size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.blocklistScroll} contentContainerStyle={{ paddingBottom: 40 }}>
            {blocklistTab === "artists" && (() => {
              const searchLower = blockSearch.toLowerCase();
              const filteredCustom = blockedArtists.filter((a) => a.toLowerCase().includes(searchLower));
              const dedupedBuiltIn = MAJOR_ARTISTS.filter(
                (a) => !blockedArtists.some((ca) => ca.toLowerCase() === a.toLowerCase())
              );
              const filteredBuiltIn = dedupedBuiltIn.filter((a) => a.toLowerCase().includes(searchLower));
              const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());
              return (
                <>
                  {filteredCustom.length > 0 && (
                    <View style={styles.blockSectionHeader}>
                      <Text style={styles.blockSectionLabel}>CUSTOM ({filteredCustom.length})</Text>
                    </View>
                  )}
                  {filteredCustom.map((artist, i) => {
                    const origIdx = blockedArtists.indexOf(artist);
                    return (
                      <View key={`ca-${i}`} style={styles.blockItem}>
                        <View style={styles.blockItemLeft}>
                          <View style={[styles.blockItemIcon, { backgroundColor: Colors.accentDim }]}>
                            <UserX size={12} color={Colors.accent} />
                          </View>
                          <Text style={styles.blockItemText}>{artist}</Text>
                        </View>
                        <TouchableOpacity onPress={() => removeBlockedArtist(origIdx)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <Trash2 size={16} color="#ff4466" />
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                  {filteredBuiltIn.length > 0 && (
                    <View style={styles.blockSectionHeader}>
                      <Text style={styles.blockSectionLabel}>BUILT-IN ({filteredBuiltIn.length})</Text>
                      <Lock size={10} color={Colors.textMuted} />
                    </View>
                  )}
                  {filteredBuiltIn.map((artist, i) => (
                    <View key={`ba-${i}`} style={[styles.blockItem, styles.blockItemBuiltIn]}>
                      <View style={styles.blockItemLeft}>
                        <View style={[styles.blockItemIcon, { backgroundColor: "#1a1a2e" }]}>
                          <Lock size={10} color={Colors.textMuted} />
                        </View>
                        <Text style={[styles.blockItemText, { color: Colors.textSecondary }]}>{titleCase(artist)}</Text>
                      </View>
                    </View>
                  ))}
                  {filteredCustom.length === 0 && filteredBuiltIn.length === 0 && (
                    <View style={styles.emptyBlock}>
                      <Search size={32} color={Colors.textMuted} />
                      <Text style={styles.emptyBlockText}>No matching artists</Text>
                    </View>
                  )}
                </>
              );
            })()}
            {blocklistTab === "labels" && (() => {
              const searchLower = blockSearch.toLowerCase();
              const filteredCustom = blockedLabels.filter((l) => l.toLowerCase().includes(searchLower));
              const dedupedBuiltIn = MAJOR_LABELS.filter(
                (l) => !blockedLabels.some((cl) => cl.toLowerCase() === l.toLowerCase())
              );
              const filteredBuiltIn = dedupedBuiltIn.filter((l) => l.toLowerCase().includes(searchLower));
              const titleCase = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());
              return (
                <>
                  {filteredCustom.length > 0 && (
                    <View style={styles.blockSectionHeader}>
                      <Text style={styles.blockSectionLabel}>CUSTOM ({filteredCustom.length})</Text>
                    </View>
                  )}
                  {filteredCustom.map((label, i) => {
                    const origIdx = blockedLabels.indexOf(label);
                    return (
                      <View key={`cl-${i}`} style={styles.blockItem}>
                        <View style={styles.blockItemLeft}>
                          <View style={[styles.blockItemIcon, { backgroundColor: "#332200" }]}>
                            <Building2 size={12} color={Colors.warning} />
                          </View>
                          <Text style={styles.blockItemText}>{label}</Text>
                        </View>
                        <TouchableOpacity onPress={() => removeBlockedLabel(origIdx)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <Trash2 size={16} color="#ff4466" />
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                  {filteredBuiltIn.length > 0 && (
                    <View style={styles.blockSectionHeader}>
                      <Text style={styles.blockSectionLabel}>BUILT-IN ({filteredBuiltIn.length})</Text>
                      <Lock size={10} color={Colors.textMuted} />
                    </View>
                  )}
                  {filteredBuiltIn.map((label, i) => (
                    <View key={`bl-${i}`} style={[styles.blockItem, styles.blockItemBuiltIn]}>
                      <View style={styles.blockItemLeft}>
                        <View style={[styles.blockItemIcon, { backgroundColor: "#1a1a2e" }]}>
                          <Lock size={10} color={Colors.textMuted} />
                        </View>
                        <Text style={[styles.blockItemText, { color: Colors.textSecondary }]}>{titleCase(label)}</Text>
                      </View>
                    </View>
                  ))}
                  {filteredCustom.length === 0 && filteredBuiltIn.length === 0 && (
                    <View style={styles.emptyBlock}>
                      <Search size={32} color={Colors.textMuted} />
                      <Text style={styles.emptyBlockText}>No matching labels</Text>
                    </View>
                  )}
                </>
              );
            })()}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const SoundCard = React.memo(function SoundCard({
  sound,
  index,
  expanded,
  excluded,
  onToggle,
  onOpenTikTok,
  onExclude,
  onBlockArtist,
  isSongs,
  comment,
  onCommentChange,
}: {
  sound: ReportSound;
  index: number;
  expanded: boolean;
  excluded: boolean;
  onToggle: () => void;
  onOpenTikTok: (url: string) => void;
  onExclude: () => void;
  onBlockArtist: (artist: string) => void;
  isSongs?: boolean;
  comment: string;
  onCommentChange: (text: string) => void;
}) {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      delay: index * 60,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim, index]);

  return (
    <Animated.View style={[styles.soundCard, { opacity: fadeAnim }, excluded && styles.soundCardExcluded]}>
      <TouchableOpacity onPress={onToggle} activeOpacity={0.8}>
        <View style={styles.soundTop}>
          <TouchableOpacity
            onPress={onExclude}
            style={[styles.excludeBtn, excluded && styles.excludeBtnActive]}
            activeOpacity={0.6}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {excluded ? (
              <Text style={styles.excludeBtnUndoText}>↩</Text>
            ) : (
              <X size={12} color="#ff4466" />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              onBlockArtist(sound.artist);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            }}
            style={styles.blockBtn}
            activeOpacity={0.6}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <ShieldBan size={12} color="#ff9500" />
          </TouchableOpacity>
          <View style={styles.soundRank}>
            <Text style={styles.soundRankText}>{sound.rank}</Text>
          </View>
          <View style={styles.soundInfo}>
            <Text style={[styles.soundName, excluded && styles.textExcluded]} numberOfLines={1}>
              {sound.songTitle || sound.soundName}
            </Text>
            <Text style={[styles.soundArtist, excluded && styles.textExcluded]} numberOfLines={1}>
              {sound.artist}
              {sound.label ? ` · ${sound.label}` : ""}
            </Text>
          </View>
          <View style={styles.soundStats}>
            <Text style={styles.soundCreates}>
              {formatCreates(isSongs ? sound.createsTotal : (sound.creates24h || sound.createsTotal))}
            </Text>
            <Text style={styles.soundCreatesLabel}>{isSongs ? "total creates" : "creates"}</Text>
          </View>
        </View>

        {isSongs && (
          <View style={styles.songStatsRow}>
            <View style={styles.songStatItem}>
              <Text style={styles.songStatValue}>{formatCreates(sound.creates24h)}</Text>
              <Text style={styles.songStatLabel}>HR Creates</Text>
            </View>
            <View style={styles.songStatItem}>
              <Text style={styles.songStatValue}>{formatCreates(sound.creates7d)}</Text>
              <Text style={styles.songStatLabel}>7D Creates</Text>
            </View>
            <View style={styles.songStatItem}>
              <Text style={[styles.songStatValue, { color: "#1DB954" }]}>{sound.streams ? formatCreates(sound.streams) : "—"}</Text>
              <Text style={styles.songStatLabel}>Streams</Text>
            </View>
            <View style={styles.songStatItem}>
              <Text style={[styles.songStatValue, { color: "#FF4444" }]}>{sound.views ? formatCreates(sound.views) : "—"}</Text>
              <Text style={styles.songStatLabel}>Views</Text>
            </View>
          </View>
        )}

        <View style={styles.soundMarkets}>
          {sound.markets.map((mId) => {
            const m = MARKETS.find((mk) => mk.id === mId);
            return m ? (
              <View
                key={mId}
                style={[styles.marketTag, { backgroundColor: m.color + "20" }]}
              >
                <Text style={styles.marketTagText}>
                  {m.flag} {m.id.toUpperCase()}
                </Text>
              </View>
            ) : null;
          })}
          {sound.growth24h ? (
            <View style={styles.growthTag}>
              <TrendingUp size={10} color={Colors.success} />
              <Text style={styles.growthText}>{sound.growth24h}</Text>
            </View>
          ) : null}
          <ChevronRight
            size={14}
            color={Colors.textMuted}
            style={{
              marginLeft: "auto" as const,
              transform: [{ rotate: expanded ? "90deg" : "0deg" }],
            }}
          />
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.soundExpanded}>
          <View style={styles.soundDetailRow}>
            <Text style={styles.detailLabel}>{isSongs ? "HR Creates" : "24h Creates"}</Text>
            <Text style={styles.detailValue}>
              {formatCreates(sound.creates24h)}
            </Text>
          </View>
          <View style={styles.soundDetailRow}>
            <Text style={styles.detailLabel}>7D Creates</Text>
            <Text style={styles.detailValue}>
              {formatCreates(sound.creates7d)}
            </Text>
          </View>
          <View style={styles.soundDetailRow}>
            <Text style={styles.detailLabel}>Total Creates</Text>
            <Text style={styles.detailValue}>
              {formatCreates(sound.createsTotal)}
            </Text>
          </View>
          {isSongs && (
            <>
              <View style={styles.soundDetailRow}>
                <Text style={styles.detailLabel}>Streams</Text>
                <Text style={[styles.detailValue, { color: "#1DB954" }]}>
                  {sound.streams ? formatCreates(sound.streams) : "—"}
                </Text>
              </View>
              <View style={styles.soundDetailRow}>
                <Text style={styles.detailLabel}>Views</Text>
                <Text style={[styles.detailValue, { color: "#FF4444" }]}>
                  {sound.views ? formatCreates(sound.views) : "—"}
                </Text>
              </View>
            </>
          )}
          {sound.growth24h ? (
            <View style={styles.soundDetailRow}>
              <Text style={styles.detailLabel}>24h Growth</Text>
              <Text style={[styles.detailValue, { color: Colors.success }]}>
                {sound.growth24h}%
              </Text>
            </View>
          ) : null}

          {sound.tiktokLink && !isSongs ? (
            <TouchableOpacity
              style={styles.tiktokBtn}
              onPress={() => onOpenTikTok(sound.tiktokLink)}
              activeOpacity={0.7}
            >
              <Music size={14} color="#fff" />
              <Text style={styles.tiktokBtnText}>Open on TikTok</Text>
              <ExternalLink size={12} color="#fff" />
            </TouchableOpacity>
          ) : null}

          <View style={styles.commentSection}>
            <Text style={styles.commentLabel}>Comment</Text>
            <TextInput
              style={styles.commentInput}
              placeholder="Add a note..."
              placeholderTextColor={Colors.textMuted}
              value={comment}
              onChangeText={onCommentChange}
              multiline
              numberOfLines={2}
              textAlignVertical="top"
              testID={`comment-input-${sound.id}`}
            />
          </View>
        </View>
      )}
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  modeToggleRow: {
    flexDirection: "row" as const,
    gap: 10,
    marginBottom: 14,
  },
  modeToggleBtn: {
    flex: 1,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  modeToggleBtnActive: {
    backgroundColor: Colors.accentDim,
    borderColor: Colors.accent + "40",
  },
  modeToggleText: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: Colors.textMuted,
  },
  modeToggleTextActive: {
    color: Colors.accent,
  },
  modeBadge: {
    backgroundColor: "#1E1E2E",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    paddingHorizontal: 5,
  },
  modeBadgeActive: {
    backgroundColor: Colors.accent + "30",
  },
  modeBadgeText: {
    fontSize: 11,
    fontWeight: "700" as const,
    color: Colors.textMuted,
  },
  modeBadgeTextActive: {
    color: Colors.accent,
  },
  chartexButton: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 10,
    backgroundColor: "#1A1A2E",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: "#2A2A3E",
    marginBottom: 16,
  },
  chartexButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600" as const,
    flex: 1,
  },
  header: {
    paddingTop: 16,
    paddingBottom: 24,
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  logoIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.accentDim,
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: {
    fontSize: 22,
    fontWeight: "800" as const,
    color: Colors.text,
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  date: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 4,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700" as const,
    color: Colors.textSecondary,
    letterSpacing: 1.5,
  },
  sectionDesc: {
    fontSize: 13,
    color: Colors.textMuted,
    marginBottom: 16,
    lineHeight: 18,
  },
  marketCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  marketCardLoaded: {
    backgroundColor: "#0D1218",
  },
  marketLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  marketFlag: {
    fontSize: 28,
  },
  marketLabel: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: Colors.text,
  },
  marketStatus: {
    fontSize: 12,
    fontWeight: "500" as const,
    marginTop: 2,
  },
  marketStatusEmpty: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  generateBtn: {
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 20,
  },
  generateBtnDisabled: {
    opacity: 0.5,
  },
  generateGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 18,
    paddingHorizontal: 24,
  },
  generateText: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: "#fff",
  },
  generateTextDisabled: {
    color: Colors.textMuted,
  },
  reportHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  reportTitle: {
    fontSize: 24,
    fontWeight: "800" as const,
    color: Colors.text,
  },
  reportSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  reportActions: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 8,
  },
  pdfBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.accentDim,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  txtBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#1A1F2A",
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  resetBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },
  statChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  statFlag: {
    fontSize: 14,
  },
  statCount: {
    fontSize: 14,
    fontWeight: "700" as const,
  },
  marketSection: {
    marginBottom: 24,
  },
  marketSectionHeader: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderLeftWidth: 4,
    marginBottom: 10,
  },
  marketSectionFlag: {
    fontSize: 28,
  },
  marketSectionTitle: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: Colors.text,
  },
  marketSectionCount: {
    fontSize: 12,
    fontWeight: "500" as const,
    marginTop: 2,
  },
  emptyReport: {
    alignItems: "center",
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 280,
  },
  emptySubtext: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: "center",
  },
  soundCard: {
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  soundTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  soundRank: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.accentDim,
    alignItems: "center",
    justifyContent: "center",
  },
  soundRankText: {
    fontSize: 13,
    fontWeight: "800" as const,
    color: Colors.accent,
  },
  soundInfo: {
    flex: 1,
  },
  soundName: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: Colors.text,
  },
  soundArtist: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  soundStats: {
    alignItems: "flex-end",
  },
  soundCreates: {
    fontSize: 15,
    fontWeight: "700" as const,
    color: Colors.success,
  },
  soundCreatesLabel: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 1,
  },
  songStatsRow: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  songStatItem: {
    alignItems: "center" as const,
    flex: 1,
  },
  songStatValue: {
    fontSize: 13,
    fontWeight: "700" as const,
    color: Colors.text,
  },
  songStatLabel: {
    fontSize: 9,
    fontWeight: "500" as const,
    color: Colors.textMuted,
    marginTop: 2,
    textTransform: "uppercase" as const,
    letterSpacing: 0.5,
  },
  soundMarkets: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  marketTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  marketTagText: {
    fontSize: 10,
    fontWeight: "600" as const,
    color: Colors.textSecondary,
  },
  growthTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: Colors.successDim,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  growthText: {
    fontSize: 10,
    fontWeight: "600" as const,
    color: Colors.success,
  },
  soundExpanded: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    gap: 8,
  },
  dataSectionHeader: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 8,
    marginBottom: 2,
    marginTop: 4,
  },
  dataSectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dataSectionTitle: {
    fontSize: 12,
    fontWeight: "700" as const,
    color: Colors.textSecondary,
    letterSpacing: 0.5,
    textTransform: "uppercase" as const,
  },
  dataSectionSub: {
    fontSize: 10,
    color: Colors.textMuted,
    fontWeight: "400" as const,
  },
  soundDetailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  detailLabel: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: Colors.textSecondary,
  },
  tiktokBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#1A1A2E",
    borderRadius: 10,
    paddingVertical: 12,
    marginTop: 4,
  },
  tiktokBtnText: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: "#fff",
  },
  commentSection: {
    marginTop: 8,
  },
  commentLabel: {
    fontSize: 11,
    fontWeight: "600" as const,
    color: Colors.textMuted,
    letterSpacing: 0.5,
    textTransform: "uppercase" as const,
    marginBottom: 6,
  },
  commentInput: {
    backgroundColor: Colors.inputBg,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    minHeight: 44,
    maxHeight: 100,
  },
  soundCardExcluded: {
    opacity: 0.4,
    borderColor: "#ff446630",
  },
  excludeBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#ff446615",
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  blockBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#ff950015",
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  excludeBtnActive: {
    backgroundColor: "#ffffff15",
  },
  excludeBtnUndoText: {
    fontSize: 12,
    color: "#aaa",
  },
  textExcluded: {
    textDecorationLine: "line-through" as const,
    color: "#666",
  },
  blocklistFab: {
    position: "absolute" as const,
    right: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#1E1E2E",
    alignItems: "center" as const,
    justifyContent: "center" as const,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  fabBadge: {
    position: "absolute" as const,
    top: -4,
    right: -4,
    backgroundColor: Colors.accent,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    paddingHorizontal: 5,
  },
  fabBadgeText: {
    fontSize: 11,
    fontWeight: "700" as const,
    color: "#fff",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  modalHeader: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800" as const,
    color: Colors.text,
  },
  modalSubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  modalClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.card,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  tabRow: {
    flexDirection: "row" as const,
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 10,
  },
  tab: {
    flex: 1,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  tabActive: {
    backgroundColor: Colors.accentDim,
    borderColor: Colors.accent + "40",
  },
  tabText: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: Colors.textMuted,
  },
  tabTextActive: {
    color: Colors.accent,
  },
  addRow: {
    flexDirection: "row" as const,
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 10,
  },
  addInput: {
    flex: 1,
    backgroundColor: Colors.inputBg,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  addBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.accent,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  blocklistScroll: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  searchRow: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  searchBar: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    backgroundColor: Colors.inputBg,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
    padding: 0,
  },
  blockSectionHeader: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 4,
    marginTop: 8,
  },
  blockSectionLabel: {
    fontSize: 11,
    fontWeight: "700" as const,
    color: Colors.textMuted,
    letterSpacing: 1.2,
  },
  blockItemBuiltIn: {
    backgroundColor: "#0D0D18",
    borderColor: "#1a1a25",
  },
  emptyBlock: {
    alignItems: "center" as const,
    paddingTop: 60,
    gap: 10,
  },
  emptyBlockText: {
    fontSize: 15,
    color: Colors.textSecondary,
    fontWeight: "600" as const,
  },
  emptyBlockSub: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: "center" as const,
  },
  blockItem: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  blockItemLeft: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 12,
    flex: 1,
  },
  blockItemIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: Colors.accentDim,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  blockItemText: {
    fontSize: 14,
    fontWeight: "500" as const,
    color: Colors.text,
    flex: 1,
  },
});
