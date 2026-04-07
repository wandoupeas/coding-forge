#!/usr/bin/env python3

from __future__ import annotations

import argparse
import copy
import re
import shutil
import tempfile
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path


W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
XML_NS = "http://www.w3.org/XML/1998/namespace"
NS = {"w": W_NS}
W_P = f"{{{W_NS}}}p"
W_PPR = f"{{{W_NS}}}pPr"
W_R = f"{{{W_NS}}}r"
W_RPR = f"{{{W_NS}}}rPr"
W_T = f"{{{W_NS}}}t"


REPLACEMENT_PARAGRAPHS: list[tuple[str, str]] = [
    (
        "section4",
        "4、本发明技术方案的详细阐述（发明内容），应该结合结构图、流程图、原理框图、电路图或时序图进行说明。",
    ),
    (
        "body",
        "为解决上述技术问题，本发明提出一种面向编码智能体的仓库内状态持久化与恢复方案，其核心是在代码仓库内部建立统一状态契约目录，使任务推进、上下文组装、执行结果回写、中断恢复、协作通信和经验学习均围绕同一事实源运行。该方案可以结合图1至图6所示的结构图、流程图、原理框图和时序关系图进行理解。",
    ),
    ("h41", "4.1  本发明所要解决的技术问题（发明目的）"),
    (
        "body",
        "本发明的第一目的在于提供一种将项目运行状态与源代码共同落盘于同一仓库的技术方案，使任务、阶段、知识、交付物、会话、运行时及日志不再分散保存在聊天记录、临时脚本或外部协调系统中。",
    ),
    (
        "body",
        "本发明的第二目的在于提供一种在会话中断、上下文压缩、模型切换、执行主体切换或权限变化后仍可恢复当前任务、建议读取内容和下一动作的恢复机制，以降低续作成本并提高工程连续性。",
    ),
    (
        "body",
        "本发明的第三目的在于提供一种覆盖自动运行路径与直接作业路径的双路径回写方案，使编码智能体即使未经过自动运行时主循环，也能够把任务状态、会话摘要、交付物和工作快照重新纳入统一状态层。",
    ),
    (
        "body",
        "本发明的第四目的在于提供一种兼容多工作者角色、多智能体提供方、异步消息协作和学习提醒的工程运行方法，以提高系统的可审计性、可接替性和重复错误抑制能力。",
    ),
    ("h42", "4.2  本发明提供的完整技术方案（发明方案）"),
    (
        "body",
        "结合图1所示，本发明整体上包括仓库内状态契约层、状态服务层、执行核心层、编码智能体门面层、兼容命令行接口层、工作流增强层以及观察界面层。所述状态契约层作为统一事实源，状态服务层负责对任务、阶段、知识、交付物、会话、运行时、线程链接和学习记录进行读写，执行核心层负责任务推进和结果回写，观察界面层负责只读聚合展示。",
    ),
    (
        "body",
        "结合图2所示，状态契约目录优选设置在仓库内固定路径下，至少包括运行时状态文件、任务图文件、阶段图文件、知识索引目录、交付物索引目录、会话索引目录、邮箱目录、日志目录、线程链接文件和学习记录目录。各索引之间通过任务标识、阶段标识、会话标识和交付物标识建立关联，以保证不同模块能够围绕同一任务链路进行状态推导和结果追踪。",
    ),
    (
        "body",
        "规划模块首先读取知识索引及知识文档，对需求、设计、决策和数据说明进行关键词提取和结构化解析，并结合工作区当前状态生成阶段图与任务图。所生成的任务图至少记录任务标题、依赖关系、优先级、执行模式、关联知识和状态字段，以便后续自动判定就绪任务及其执行顺序。",
    ),
    (
        "body",
        "结合图3所示，运行时模块启动后先加载状态契约，再根据依赖满足条件、任务优先级和创建顺序选取就绪任务；任务被认领后写入当前任务标识、当前阶段标识和运行摘要，并进入执行上下文构建步骤。若任务被标记为人工执行模式，则自动循环暂停，同时保留当前任务位置和提示信息，以供编码智能体直接接管。",
    ),
    (
        "body",
        "执行前，工作者管理模块根据任务标题、任务描述或预设模块推断工作者角色，并装载相应的技能集合和运行档案。编码智能体门面层根据运行档案匹配不同提供方适配器，将统一的任务输入转换为具体智能体可执行的提示、命令或调用参数，从而在不改变状态契约的情况下兼容不同执行主体。",
    ),
    (
        "body",
        "结合图4所示，执行上下文构建模块将当前任务对象、所属阶段对象、按类别归集的知识项集合、当前任务关联交付物、相关会话集合、工作流上下文、权限提示和观察快照统一组装为执行上下文。其中，观察快照用于反映当前工作区内就绪任务数、阻塞任务数、待审交付物数、未读消息数和相关会话数量，为执行主体提供面向当前任务的最小必要工作面。",
    ),
    (
        "body",
        "在优选实施方式中，权限提示还包括可写范围、审批要求和阻断原因。当执行主体处于只读环境或目标操作超出允许范围时，系统可将任务标记为阻塞状态，并在运行日志中写入阻断原因，以避免出现未获授权的写入或不完整执行。",
    ),
    (
        "body",
        "任务执行完成后，持久化模块将结果摘要、交付物路径、审阅状态、异常信息和执行元数据回写至交付物索引、任务图、阶段图、运行时状态、会话快照和运行日志，并对依赖关系重新判断。当前置任务完成导致后续任务满足依赖条件时，系统自动解锁相应任务，形成从任务选择到状态回写的闭环推进机制。",
    ),
    (
        "body",
        "结合图5所示，恢复模块在收到恢复请求后，按照运行时状态、任务图与阶段图、会话索引、知识索引和交付物索引的顺序读取状态，再对工作流上下文、线程链接、关联工件和工作区路径进行完整性校验。在此基础上，恢复模块生成当前状态摘要、建议读取列表和下一动作，用于指导同一编码智能体继续执行，或者指导新的执行主体接续工作。",
    ),
    (
        "body",
        "在一优选实施方式中，恢复输出不仅指示当前任务和当前阶段，还可给出建议优先阅读的知识文档、最近会话、相关交付物和待处理审阅项。若发现工件缺失、工作区路径失效或线程链接不完整，则恢复模块直接给出阻断信号和缺失项，防止执行主体在错误上下文中继续作业。",
    ),
    (
        "body",
        "结合图6所示，当编码智能体未经过自动运行时主循环而直接在仓库中修改文件时，旁路回写模块用于将任务状态、会话摘要、运行时日志、交付物路径和工作快照重新写入状态契约层。优选地，所述旁路回写模块包括任务回写子模块、会话回写子模块、自动变更检测回写子模块和停止快照子模块。",
    ),
    (
        "body",
        "为支持多执行主体协作，本发明还设置持久化邮箱消息机制，用于在工作者之间传递审阅请求、审批结果或上下文补充信息；同时设置学习模块，用于记录错误标题、错误类别、根因、修复方式和预防策略，并在后续相关任务启动时输出提醒，从而形成持续纠错和经验沉淀能力。",
    ),
    (
        "body",
        "此外，本发明还可以设置多项目只读观察界面，对多个包含状态契约目录的仓库进行扫描和聚合，形成项目索引、工作区账本、运行时事件流、恢复轨迹以及交付物证据的统一观察面。借助该观察面，人工管理者或另一执行主体能够快速判断多个项目的推进状态和接手入口。",
    ),
    ("h43", "4.3、本发明的技术关键点或欲保护点是什么"),
    (
        "body",
        "1. 以仓库内状态契约目录作为统一事实源，将任务图、阶段图、知识索引、交付物索引、会话索引、运行时状态、线程链接、邮箱消息及学习记录关联持久化，而非依赖对话上下文或外部调度器保存项目真相。",
    ),
    (
        "body",
        "2. 基于依赖满足条件和优先级选择就绪任务，并围绕任务认领、执行上下文构建、权限校验、执行结果持久化和依赖解锁形成闭环任务推进机制。",
    ),
    (
        "body",
        "3. 将任务对象、阶段对象、知识分类集合、交付物、会话、工作流上下文、权限提示和观察快照统一组装为执行上下文的技术手段，使执行主体在最小必要信息集下完成作业。",
    ),
    (
        "body",
        "4. 自动运行路径与直接作业路径并存时，通过旁路回写、自动变更检测回写和停止快照回写保持状态一致性的双路径回写机制。",
    ),
    (
        "body",
        "5. 将运行时摘要、会话索引、建议读取列表生成、工作流上下文校验、线程链接校验和缺失工件检查结合起来，形成可中断、可接替、可验证的恢复机制。",
    ),
    (
        "body",
        "6. 通过工作者角色推断、提供方适配器、异步邮箱、学习提醒及多项目观察界面的组合，实现多执行主体兼容、协作消息沉淀和重复错误抑制。",
    ),
    ("h44", "4.4、发明的有益效果"),
    (
        "body",
        "与依赖聊天记录、临时提示词或外部编排器保存状态的现有技术相比，本发明将关键工程状态直接固化在代码仓库内，使任务、阶段、知识、交付物、会话和日志围绕同一事实源运行，显著降低状态分裂和信息遗漏风险。",
    ),
    (
        "body",
        "与将任务推进、上下文准备和结果登记分散处理的现有方案相比，本发明通过就绪任务运行时主循环、执行上下文组装和持久化回写机制，使任务推进链、证据链和恢复链保持同步，减少人工登记和人工恢复成本。",
    ),
    (
        "body",
        "与缺少中断恢复能力的现有方案相比，本发明通过运行时状态、会话摘要、工作流上下文、线程链接以及缺失工件校验的联合使用，在窗口关闭、模型切换、上下文压缩或执行主体更替后仍能快速给出可继续执行的路径，提高恢复效率和连续作业能力。",
    ),
    (
        "body",
        "与只能覆盖自动调度路径的现有方案相比，本发明还提供旁路回写和停止快照机制，使编码智能体直接在仓库中作业时仍可将结果纳入统一状态层，避免形成不可追溯的隐藏修改。",
    ),
    (
        "body",
        "与缺少权限约束、观察诊断和经验沉淀的现有方案相比，本发明通过权限提示、观察快照、健康检查、学习记录和提醒输出机制实现执行阻断、状态审计和持续改进，提高工程运行稳定性。",
    ),
    (
        "body",
        "与仅面向单一执行主体或单一项目的现有方案相比，本发明能够兼容多工作者角色、多智能体提供方和多项目观察场景，便于在复杂软件工程环境下进行跨会话、跨主体的稳定协作。",
    ),
    ("section5", "5、具体实施例"),
    (
        "body",
        "实施例一：标准任务执行链路实施例。在本实施例中，首先在代码仓库中建立状态契约目录，并预先写入任务图、阶段图、知识索引、会话索引和交付物索引。规划模块读取需求、设计和决策类知识文档，抽取阶段、任务、依赖关系和优先级，生成可供运行时模块消费的任务图。",
    ),
    (
        "body",
        "运行时模块启动后，根据依赖满足条件筛选就绪任务，并按照优先级和创建顺序选出当前任务。任务被认领后，系统读取该任务所属阶段、关联知识项、当前任务历史交付物、相关会话以及当前运行时状态，进一步结合权限提示和观察快照，构造统一执行上下文。",
    ),
    (
        "body",
        "随后，工作者管理模块依据任务语义推断工作者角色，编码智能体门面层根据运行档案选择对应适配器驱动具体执行主体执行任务。任务执行完成后，持久化模块将任务摘要、交付物路径、执行元数据和审阅状态回写至交付物索引、任务图、阶段图、会话索引及运行日志，并自动判断是否解锁后续任务。",
    ),
    (
        "body",
        "通过本实施例，可使任务推进链条、上下文准备链条和交付物证据链条围绕同一状态契约同步更新，避免出现代码已修改而任务图、会话摘要和交付物索引未同步的情况。",
    ),
    (
        "body",
        "实施例二：恢复与续作链路实施例。在本实施例中，当执行过程因窗口关闭、上下文压缩、模型切换、权限变化或人员交接而中断时，恢复模块接收恢复请求后，先读取运行时状态以判断当前是否存在活动任务，再读取任务图、阶段图、会话索引、知识索引和交付物索引，建立恢复所需的基础上下文。",
    ),
    (
        "body",
        "随后，恢复模块进一步检查工作流上下文、线程链接、关联工件以及工作区路径是否完整。若相关工件缺失、工作区路径失效或线程链接不完整，则恢复模块输出阻断原因及缺失项；若检查通过，则生成当前状态摘要、建议读取列表和下一动作。",
    ),
    (
        "body",
        "在该实施例中，建议读取列表可优先包括当前任务关联知识文档、最近一次会话摘要、当前任务历史交付物、待审阅事项以及与当前阶段相关的设计说明。新的执行主体依据该摘要和建议读取列表即可恢复到相对完整的工作面，并继续执行后续动作。",
    ),
    (
        "body",
        "通过本实施例，可将恢复过程从依赖人工回忆和聊天翻找，转变为基于统一状态契约的结构化恢复过程，从而显著提高续作效率和接替稳定性。",
    ),
    (
        "body",
        "实施例三：旁路回写与学习闭环实施例。在本实施例中，当某一任务被设置为人工执行模式，或者编码智能体绕过自动运行时主循环直接在仓库中进行文件修改时，旁路回写模块对直接作业结果进行统一回写。所述回写内容至少包括任务状态、作业摘要、交付物路径、运行日志和会话快照。",
    ),
    (
        "body",
        "优选地，旁路回写模块可以分别执行任务回写、会话回写、自动变更检测回写以及停止时快照回写。其中，任务回写用于更新任务状态和摘要，会话回写用于更新当前工作会话，自动变更检测回写用于将检测到的文件变更与任务绑定，停止时快照回写用于在作业暂停时保留最后一次工作概况。",
    ),
    (
        "body",
        "当直接作业过程中出现错误修复、工作流纠正或重复问题时，学习模块记录错误标题、错误类别、根因、修复措施和预防策略，并在后续相关任务启动时主动输出提醒，使后续执行主体在进入任务前即可获得历史教训。",
    ),
    (
        "body",
        "通过本实施例，即使存在未经过自动运行路径的仓库内直接作业行为，系统仍可保持任务状态、会话状态和交付物状态的一致性，并形成错误记录到提醒输出的持续学习闭环。",
    ),
    (
        "body",
        "实施例四：多工作者、多提供方兼容与多项目观察实施例。在本实施例中，系统根据任务标题、描述或模块归属推断不同工作者角色，并为不同编码智能体提供方配置统一适配接口。各执行主体在保持统一状态契约和统一回写格式的前提下，可以选择不同模型或不同执行配置完成任务。",
    ),
    (
        "body",
        "在多主体协作过程中，持久化邮箱消息机制用于传递审阅请求、审批结果、上下文补充信息或待办提醒，从而支持异步协作而不依赖持续在线的中心会话。恢复模块在接管时还可根据线程链接和工作流上下文判断当前接力链路是否完整。",
    ),
    (
        "body",
        "与此同时，多项目观察界面对多个包含状态契约目录的仓库进行扫描，形成项目索引、工作区账本、运行时事件流、恢复轨迹和交付物证据视图。观察者可据此识别哪个项目存在活动任务、哪个项目存在阻塞项、哪个项目存在待审交付物，并据此安排人工接手或新的执行主体接续作业。",
    ),
    (
        "body",
        "通过本实施例，本发明不仅适用于单一编码智能体的连续执行场景，也适用于多提供方、多角色和多项目并行管理场景，从而增强方案的工程适用性和扩展能力。",
    ),
    (
        "body",
        "上述实施例中的状态契约字段、知识分类方式、交付物类型、工作者数量、提供方种类、观察界面样式以及学习策略均可根据实际应用需要调整，只要仍然基于仓库内统一事实源完成任务执行、状态回写、恢复推导和学习提醒，均应落入本发明的保护范围。",
    ),
    ("section6", "6、附图及说明"),
    (
        "body",
        "图1宜绘制为本发明整体系统架构结构图，用于说明状态契约层、状态服务层、执行核心层、编码智能体门面层、兼容命令行接口层、工作流增强层和观察界面层之间的层次关系。图中可将1表示为仓库内状态契约层，2表示为状态服务层，3表示为执行核心层，4表示为编码智能体门面层，5表示为兼容命令行接口层，6表示为工作流增强层，7表示为观察界面层；层间箭头用于表示状态读取、任务推进、结果回写和只读观察关系。",
    ),
    (
        "body",
        "图2宜绘制为本发明状态契约目录结构图，用于说明仓库内统一事实源的目录组成及索引关系。图中可将21表示为运行时状态文件，22表示为任务图文件，23表示为阶段图文件，24表示为知识索引目录，25表示为交付物索引目录，26表示为会话索引目录，27表示为邮箱目录，28表示为日志目录，29表示为线程链接文件，210表示为学习记录目录；优选地，可用包含关系或树形结构表示其隶属关系。",
    ),
    (
        "body",
        "图3宜绘制为本发明就绪任务运行时主循环流程图，用于说明任务从状态加载到依赖解锁的闭环推进过程。图中可将31表示为加载状态步骤，32表示为筛选并选取就绪任务步骤，33表示为认领任务步骤，34表示为构建执行上下文步骤，35表示为权限检查与执行主体调用步骤，36表示为持久化交付物和执行结果步骤，37表示为更新任务、阶段、会话和运行时步骤，38表示为解锁依赖任务或结束当前循环步骤；如需细化，还可在图中标注人工执行模式下的暂停分支。",
    ),
    (
        "body",
        "图4宜绘制为本发明执行上下文组装原理框图，用于说明执行主体在任务开始前需要读取和聚合的信息集合。图中可将41表示为任务对象，42表示为阶段对象，43表示为知识分类集合，44表示为当前任务关联交付物集合，45表示为相关会话集合，46表示为工作流上下文，47表示为权限提示，48表示为观察快照；各输入模块可汇聚到中心执行上下文框体，再输出到执行主体。",
    ),
    (
        "body",
        "图5宜绘制为本发明恢复流程图或恢复时序图，用于说明中断后如何重新建立有效工作面。图中可将51表示为读取运行时并执行健康检查步骤，52表示为读取任务图、阶段图、会话索引、知识索引和交付物索引步骤，53表示为生成当前状态摘要步骤，54表示为工作流上下文与线程链接校验步骤，55表示为缺失工件和工作区路径校验步骤，56表示为输出建议读取列表和下一动作步骤；优选地，图中应突出阻断条件与可继续执行条件的分支。",
    ),
    (
        "body",
        "图6宜绘制为本发明旁路回写与学习闭环流程图，用于说明直接作业路径如何重新接入统一状态层。图中可将61表示为直接作业入口，62表示为旁路回写模块，63表示为运行时日志更新模块，64表示为会话快照生成模块，65表示为错误记录模块，66表示为提醒输出模块；箭头应依次表示直接作业后的状态回写、错误沉淀以及后续任务启动时的提醒反馈闭环。",
    ),
]


def register_namespaces(xml_bytes: bytes) -> None:
    text = xml_bytes.decode("utf-8")
    for prefix, uri in re.findall(r'xmlns(?::([A-Za-z_][\\w.-]*))?="([^"]+)"', text):
        ET.register_namespace(prefix or "", uri)


def extract_text(paragraph: ET.Element) -> str:
    return "".join(node.text or "" for node in paragraph.findall(".//w:t", NS))


def clone_paragraph(template: ET.Element, text: str) -> ET.Element:
    paragraph = copy.deepcopy(template)
    for child in list(paragraph):
        if child.tag != W_PPR:
            paragraph.remove(child)

    run = ET.Element(W_R)
    template_rpr = template.find("./w:r/w:rPr", NS)
    if template_rpr is not None:
        run.append(copy.deepcopy(template_rpr))

    text_node = ET.SubElement(run, W_T)
    if text[:1].isspace() or text[-1:].isspace():
        text_node.set(f"{{{XML_NS}}}space", "preserve")
    text_node.text = text
    paragraph.append(run)
    return paragraph


def build_templates(body: ET.Element) -> dict[str, ET.Element]:
    templates: dict[str, ET.Element] = {}
    for paragraph in body.findall("w:p", NS):
        text = extract_text(paragraph).strip()
        if text.startswith("4、本发明技术方案"):
            templates["section4"] = paragraph
        elif text.startswith("4.1"):
            templates["h41"] = paragraph
        elif text.startswith("4.2"):
            templates["h42"] = paragraph
        elif text.startswith("4.3"):
            templates["h43"] = paragraph
        elif text.startswith("4.4"):
            templates["h44"] = paragraph
        elif text == "5、具体实施例":
            templates["section5"] = paragraph
        elif text.startswith("6、附图"):
            templates["section6"] = paragraph
        elif text.startswith("为解决上述技术问题"):
            templates["body"] = paragraph

    missing = [key for key in ("section4", "h41", "h42", "h43", "h44", "section5", "section6", "body") if key not in templates]
    if missing:
        raise RuntimeError(f"Missing paragraph templates: {', '.join(missing)}")
    return templates


def find_rewrite_range(body: ET.Element) -> tuple[int, int]:
    children = list(body)
    start_idx: int | None = None
    end_idx: int | None = None

    for idx, child in enumerate(children):
        if child.tag != W_P:
            continue
        text = extract_text(child).strip()
        if start_idx is None and text.startswith("4、本发明技术方案"):
            start_idx = idx
        end_idx = idx

    if start_idx is None or end_idx is None or end_idx < start_idx:
        raise RuntimeError("Could not locate chapter 4-6 rewrite range")
    return start_idx, end_idx


def rewrite_document(input_path: Path, output_path: Path) -> None:
    with zipfile.ZipFile(input_path) as source_zip:
        document_xml = source_zip.read("word/document.xml")
        register_namespaces(document_xml)
        root = ET.fromstring(document_xml)
        body = root.find("w:body", NS)
        if body is None:
            raise RuntimeError("word/document.xml does not contain w:body")

        templates = build_templates(body)
        start_idx, end_idx = find_rewrite_range(body)

        for _ in range(end_idx - start_idx + 1):
            body.remove(body[start_idx])

        new_paragraphs = [
            clone_paragraph(templates[template_key], text)
            for template_key, text in REPLACEMENT_PARAGRAPHS
        ]
        for offset, paragraph in enumerate(new_paragraphs):
            body.insert(start_idx + offset, paragraph)

        updated_document_xml = ET.tostring(root, encoding="utf-8", xml_declaration=True)

        with tempfile.NamedTemporaryFile(delete=False, suffix=".docx") as tmp_file:
            temp_output = Path(tmp_file.name)

        try:
            with zipfile.ZipFile(input_path) as source_zip, zipfile.ZipFile(
                temp_output, "w", compression=zipfile.ZIP_DEFLATED
            ) as target_zip:
                for item in source_zip.infolist():
                    if item.filename == "word/document.xml":
                        target_zip.writestr(item, updated_document_xml)
                    else:
                        target_zip.writestr(item, source_zip.read(item.filename))

            output_path.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(temp_output), str(output_path))
        finally:
            if temp_output.exists():
                temp_output.unlink()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Rewrite chapters 4-6 of the patent disclosure docx")
    parser.add_argument("input", type=Path, help="Input docx path")
    parser.add_argument("output", type=Path, help="Output docx path")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    rewrite_document(args.input, args.output)


if __name__ == "__main__":
    main()
