import type { DimensionType } from "./types";

export interface TemplateDimension {
  name: { zh: string; en: string };
  description: { zh: string; en: string };
  type: DimensionType;
}

export interface DimensionTemplate {
  key: string;
  name: { zh: string; en: string };
  description: { zh: string; en: string };
  dimensions: TemplateDimension[];
}

const d = (zh: string, en: string, dzh: string, den: string, type: DimensionType = "text"): TemplateDimension => ({
  name: { zh, en },
  description: { zh: dzh, en: den },
  type,
});

export const TEMPLATES: DimensionTemplate[] = [
  {
    key: "general",
    name: { zh: "通用对比", en: "General" },
    description: { zh: "适用于大多数论文的基础维度", en: "Baseline dimensions for most papers" },
    dimensions: [
      d("研究问题", "Research Problem", "论文要解决的核心问题与动机", "Core problem and motivation"),
      d("核心方法", "Method", "提出的方法/模型/框架的关键思想", "Key idea of the proposed method"),
      d("数据 / 实验对象", "Data", "使用的数据集、样本或实验对象", "Datasets, samples or subjects used"),
      d("主要结论", "Key Findings", "最重要的结果与结论", "Most important results and conclusions"),
      d("创新点", "Contributions", "作者声称的主要贡献", "Claimed contributions"),
      d("局限性", "Limitations", "作者承认或可推断的局限", "Stated or inferred limitations"),
    ],
  },
  {
    key: "ml",
    name: { zh: "实验型 (ML/CV/NLP)", en: "Empirical (ML/CV/NLP)" },
    description: { zh: "面向机器学习实验论文", en: "For empirical machine learning papers" },
    dimensions: [
      d("任务", "Task", "解决的具体任务", "The specific task addressed"),
      d("模型架构", "Architecture", "模型结构与关键模块", "Model architecture and key modules"),
      d("训练策略", "Training", "损失函数、预训练、优化等训练细节", "Loss, pretraining, optimization details"),
      d("数据集", "Datasets", "训练与评测所用数据集", "Datasets for training and evaluation"),
      d("评价指标", "Metrics", "使用的评价指标", "Evaluation metrics used"),
      d("主结果", "Main Result", "主要数据集上的核心指标数值（尽量给出一个数字）", "Headline metric value on the main benchmark (a single number if possible)", "number"),
      d("参数量 / 计算成本", "Params / Compute", "模型参数量或计算资源", "Model size or compute", "number"),
      d("创新性评分", "Novelty", "1-5 分，方法的新颖程度", "1-5, novelty of the approach", "rating"),
      d("实验充分性", "Experimental Rigor", "1-5 分，实验与消融的充分程度", "1-5, thoroughness of experiments and ablations", "rating"),
      d("代码开源", "Code", "是否开源代码及地址", "Whether code is released and where", "tags"),
      d("局限性", "Limitations", "作者承认或可推断的局限", "Stated or inferred limitations"),
    ],
  },
  {
    key: "survey",
    name: { zh: "综述型", en: "Survey / Review" },
    description: { zh: "对比多篇综述或理论性论文", en: "For surveys or theoretical papers" },
    dimensions: [
      d("覆盖范围", "Scope", "综述覆盖的领域与时间范围", "Covered area and time span"),
      d("分类体系", "Taxonomy", "提出的分类框架", "Proposed taxonomy"),
      d("文献数量", "# Papers Reviewed", "纳入的文献数量", "Number of reviewed works", "number"),
      d("关键观点", "Key Insights", "主要观点与结论", "Main insights"),
      d("未解决问题", "Open Problems", "指出的开放问题与方向", "Open problems and directions"),
      d("全面性评分", "Comprehensiveness", "1-5 分", "1-5", "rating"),
    ],
  },
  {
    key: "clinical",
    name: { zh: "医学 / 临床", en: "Medical / Clinical" },
    description: { zh: "面向临床与医学研究", en: "For clinical and medical studies" },
    dimensions: [
      d("研究设计", "Study Design", "RCT、队列、病例对照等", "RCT, cohort, case-control, etc.", "tags"),
      d("样本量", "Sample Size", "受试者数量", "Number of participants", "number"),
      d("人群", "Population", "纳入人群特征", "Population characteristics"),
      d("干预 / 暴露", "Intervention", "干预或暴露因素", "Intervention or exposure"),
      d("对照", "Comparator", "对照组设置", "Comparator"),
      d("主要结局", "Primary Outcome", "主要结局指标与结果", "Primary outcome and result"),
      d("证据等级", "Evidence Quality", "1-5 分", "1-5", "rating"),
      d("偏倚风险", "Risk of Bias", "主要偏倚来源", "Main sources of bias"),
    ],
  },
  {
    key: "blank",
    name: { zh: "空白 (自定义)", en: "Blank (Custom)" },
    description: { zh: "从零开始定义维度", en: "Define dimensions from scratch" },
    dimensions: [],
  },
];

export function getTemplate(key: string) {
  return TEMPLATES.find((t) => t.key === key) ?? TEMPLATES[0];
}
