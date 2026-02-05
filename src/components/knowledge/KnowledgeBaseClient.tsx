"use client"

import { useState } from "react"
import { formatCurrency } from "@/lib/utils"
import { UploadQuotesButton } from "@/components/knowledge/UploadQuotesButton"
import { DeleteKnowledgeButton } from "@/components/knowledge/DeleteKnowledgeButton"
import { FixedPriceManager } from "@/components/knowledge/FixedPriceManager"
import { BrainCircuit, BookOpen, Layers } from "lucide-react"

interface KnowledgeBaseClientProps {
    historicalItems: any[]
    aiEnabled?: boolean
}

export function KnowledgeBaseClient({ historicalItems, aiEnabled = true }: KnowledgeBaseClientProps) {
    const [activeTab, setActiveTab] = useState<'historical' | 'fixed'>('historical')

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            {/* Tab Switcher */}
            <div className="flex justify-center">
                <div className="bg-[#14141E]/80 backdrop-blur-xl border border-white/5 p-1 rounded-2xl flex gap-1 shadow-2xl">
                    <button
                        onClick={() => setActiveTab('historical')}
                        className={`flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'historical'
                            ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                            : "text-muted-foreground hover:text-white hover:bg-white/5"
                            }`}
                    >
                        <BrainCircuit className="h-4 w-4" />
                        Historical Intelligence
                    </button>
                    <button
                        onClick={() => setActiveTab('fixed')}
                        className={`flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'fixed'
                            ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                            : "text-muted-foreground hover:text-white hover:bg-white/5"
                            }`}
                    >
                        <BookOpen className="h-4 w-4" />
                        Standard Catalog
                    </button>
                </div>
            </div>

            {activeTab === 'historical' ? (
                <div className="space-y-8 animate-in slide-in-from-left-4 duration-500">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-primary/10 pb-8">
                        <div className="space-y-2">
                            <h1 className="text-4xl font-black tracking-tighter text-white uppercase italic">
                                Pricing <span className="text-primary">Intelligence</span>
                            </h1>
                            <div className="bg-primary/10 border-l-4 border-primary px-4 py-2">
                                <p className="text-primary font-bold text-sm uppercase tracking-widest italic">
                                    &quot;Dynamic memory extracted from past quotations and project work.&quot;
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-4">
                            <UploadQuotesButton />
                        </div>
                    </div>

                    <div className="rounded-2xl border border-white/5 bg-[#1A1A2E] shadow-2xl overflow-hidden">
                        <div className="bg-white/5 px-6 py-4 border-b border-white/5 flex items-center justify-between">
                            <h2 className="text-lg font-black text-white uppercase tracking-widest italic">Memory Records</h2>
                            <span className="text-[10px] font-black text-primary bg-primary/10 px-2 py-0.5 rounded-full uppercase tracking-tighter border border-primary/20">
                                {historicalItems.length} records in memory
                            </span>
                        </div>
                        <div className="p-0">
                            {historicalItems.length === 0 ? (
                                <div className="text-center text-muted-foreground py-20 italic">
                                    No pricing history learned yet. Upload old quotes to train the AI.
                                </div>
                            ) : (
                                <div className="relative w-full overflow-auto">
                                    <table className="w-full text-sm text-left">
                                        <thead>
                                            <tr className="border-b border-white/5 bg-white/[0.02]">
                                                <th className="py-4 px-6 text-[10px] font-black uppercase text-muted-foreground tracking-widest italic">Service Description</th>
                                                <th className="py-4 px-6 text-right text-[10px] font-black uppercase text-primary tracking-widest italic">Typical Price</th>
                                                <th className="py-4 px-6 text-right text-[10px] font-black uppercase text-muted-foreground tracking-widest italic">Price Range</th>
                                                <th className="py-4 px-6 text-right text-[10px] font-black uppercase text-muted-foreground tracking-widest italic">Confidence</th>
                                                <th className="py-4 px-6 w-12"></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {historicalItems.map(item => (
                                                <tr key={item.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.03] transition-colors group">
                                                    <td className="py-5 px-6 font-bold text-white group-hover:text-primary transition-colors">{item.description}</td>
                                                    <td className="py-5 px-6 text-right font-black text-lg text-primary tracking-tight">{formatCurrency(item.typicalPrice)}</td>
                                                    <td className="py-5 px-6 text-right text-xs text-muted-foreground font-mono">
                                                        {formatCurrency(item.minPrice)} — {formatCurrency(item.maxPrice)}
                                                    </td>
                                                    <td className="py-5 px-6 text-right">
                                                        <div className="flex items-center justify-end gap-2">
                                                            <span className="text-[10px] font-black text-white bg-white/10 px-2 py-0.5 rounded uppercase tracking-tighter">
                                                                {item.frequency > 5 ? 'High' : item.frequency > 1 ? 'Med' : 'New'}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="py-5 px-6 text-right">
                                                        <DeleteKnowledgeButton id={item.id} />
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="space-y-8 animate-in slide-in-from-right-4 duration-500">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-primary/10 pb-8">
                        <div className="space-y-2">
                            <h1 className="text-4xl font-black tracking-tighter text-white uppercase italic">
                                Standard <span className="text-primary">Catalog</span>
                            </h1>
                            <div className="bg-primary/10 border-l-4 border-primary px-4 py-2">
                                <p className="text-primary font-bold text-sm uppercase tracking-widest italic">
                                    &quot;Controlled pricing for your most common services and materials.&quot;
                                </p>
                            </div>
                        </div>
                        <div className="text-right hidden sm:block">
                            <span className="text-[10px] font-black uppercase text-muted-foreground block opacity-50">Operational Standards</span>
                            <span className="text-xs font-bold text-white tracking-widest uppercase italic flex items-center gap-2 justify-end">
                                <Layers className="h-3 w-3 text-primary" /> Active Maintenance
                            </span>
                        </div>
                    </div>

                    <FixedPriceManager />
                </div>
            )}
        </div>
    )
}
