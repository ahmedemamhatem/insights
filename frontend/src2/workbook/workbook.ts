import { safeJSONParse } from '@/utils'
import { watchOnce } from '@vueuse/core'
import { InjectionKey, reactive, toRefs, watchEffect } from 'vue'
import { useRouter } from 'vue-router'
import { ChartConfig, ChartType } from '../charts/helpers'
import { getUniqueId } from '../helpers'
import useDocumentResource from '../helpers/resource'
import { createToast } from '../helpers/toasts'
export default function useWorkbook(name: string) {
	const resource = getWorkbookResource(name)

	type ActiveTabType = 'query' | 'chart' | 'dashboard' | ''
	const workbook = reactive({
		...toRefs(resource),

		activeTabType: '' as ActiveTabType,
		activeTabIdx: 0,

		setActiveTab(type: ActiveTabType, idx: number) {
			workbook.activeTabType = type
			workbook.activeTabIdx = idx
		},
		isActiveTab(name: string) {
			return (
				(workbook.activeTabType === 'query' &&
					workbook.doc.queries.length > 0 &&
					workbook.doc.queries[workbook.activeTabIdx].name === name) ||
				(workbook.activeTabType === 'chart' &&
					workbook.doc.charts.length > 0 &&
					workbook.doc.charts[workbook.activeTabIdx].name === name) ||
				(workbook.activeTabType === 'dashboard' &&
					workbook.doc.dashboards.length > 0 &&
					workbook.doc.dashboards[workbook.activeTabIdx].name === name)
			)
		},

		addQuery() {
			const queryName = 'new-query-' + getUniqueId()
			workbook.doc.queries.push({
				name: queryName,
				title: `Query ${workbook.doc.queries.length + 1}`,
				operations: [],
			})
			workbook.setActiveTab('query', workbook.doc.queries.length - 1)
		},

		removeQuery(queryName: string) {
			const idx = workbook.doc.queries.findIndex((row) => row.name === queryName)
			if (idx === -1) return
			workbook.doc.queries.splice(idx, 1)
			if (workbook.isActiveTab(queryName)) {
				workbook.setActiveTab('', 0)
			}
		},

		addChart() {
			const name = 'new-chart-' + getUniqueId()
			workbook.doc.charts.push({
				name,
				query: '',
				chart_type: 'Line',
				config: {} as ChartConfig,
			})
			workbook.setActiveTab('chart', workbook.doc.charts.length - 1)
		},

		removeChart(chartName: string) {
			const idx = workbook.doc.charts.findIndex((row) => row.name === chartName)
			if (idx === -1) return
			workbook.doc.charts.splice(idx, 1)
			if (workbook.isActiveTab(chartName)) {
				workbook.setActiveTab('', 0)
			}
		},

		addDashboard() {
			const name = 'new-dashboard-' + getUniqueId()
			const idx = workbook.doc.dashboards.length
			workbook.doc.dashboards.push({
				name,
				title: `Dashboard ${idx + 1}`,
				items: [],
			})
			workbook.setActiveTab('dashboard', idx)
		},

		removeDashboard(dashboardName: string) {
			const idx = workbook.doc.dashboards.findIndex((row) => row.name === dashboardName)
			if (idx === -1) return
			workbook.doc.dashboards.splice(idx, 1)
			if (workbook.isActiveTab(dashboardName)) {
				workbook.setActiveTab('', 0)
			}
		},
	})

	const router = useRouter()
	workbook.onAfterInsert(() => {
		router.replace(`/workbook/${workbook.doc.name}`)
	})
	watchEffect(() => {
		if (workbook.saving) {
			createToast({
				title: 'Saving...',
				variant: 'info',
			})
			watchOnce(
				() => workbook.saving,
				() => {
					createToast({
						title: 'Saved',
						variant: 'success',
					})
				}
			)
		}
	})

	workbook.onBeforeSave(async () => {
		workbook.doc.queries.forEach((row) => {
			row.name = row.name.startsWith('new-query-') ? '' : row.name
		})
		workbook.doc.charts.forEach((row) => {
			row.name = row.name.startsWith('new-chart-') ? '' : row.name
		})
		workbook.doc.dashboards.forEach((row) => {
			row.name = row.name.startsWith('new-dashboard-') ? '' : row.name
		})
	})

	// set first tab as active
	watchOnce(
		() => workbook.doc.queries,
		() => {
			if (workbook.doc.queries.length) {
				workbook.setActiveTab('query', 0)
			}
		}
	)

	return workbook
}

export type Workbook = ReturnType<typeof useWorkbook>
export const workbookKey = Symbol() as InjectionKey<Workbook>

function getWorkbookResource(name: string) {
	const doctype = 'Insights Workbook'
	const workbook = useDocumentResource<InsightsWorkbook>(doctype, name, {
		initialDoc: {
			doctype,
			name: '',
			title: '',
			queries: [],
			charts: [],
			dashboards: [],
		},
		transform(doc) {
			doc.queries = doc.queries.map((row) => {
				row.operations = safeJSONParse(row.operations) || []
				return row
			})
			doc.charts = doc.charts.map((row) => {
				row.config = safeJSONParse(row.config) || {}
				return row
			})
			doc.dashboards = doc.dashboards.map((row) => {
				row.items = safeJSONParse(row.items) || []
				return row
			})
			return doc
		},
	})
	return workbook
}

type InsightsWorkbook = {
	doctype: 'Insights Workbook'
	name: string
	title: string
	queries: WorkbookQuery[]
	charts: WorkbookChart[]
	dashboards: WorkbookDashboard[]
}

export type WorkbookQuery = {
	name: string
	title: string
	operations: Operation[]
}

export type WorkbookChart = {
	name: string
	query: string
	chart_type: ChartType
	config: ChartConfig
}

export type WorkbookDashboard = {
	name: string
	title: string
	items: WorkbookDashboardItem[]
}
export type WorkbookDashboardItem = {
	layout: {
		x: number
		y: number
		w: number
		h: number
	}
} & (
	| {
			type: 'chart'
			chart: string
	  }
	| {
			type: 'filter'
			filter: object
	  }
	| {
			type: 'text'
			text: string
	  }
)
