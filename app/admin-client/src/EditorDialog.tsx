import { useMutation, useQuery } from '@tanstack/react-query';
import { parseDate, parseTime } from '@internationalized/date';
import { AlertCircle, Check, ChevronDown, LoaderCircle, Minus, Plus, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
	Button,
	CheckboxButton,
	CheckboxField,
	ComboBox,
	DateField,
	DateInput,
	DateSegment,
	Dialog,
	Input,
	Label,
	ListBox,
	ListBoxItem,
	Modal,
	ModalOverlay,
	NumberField,
	Group,
	Popover,
	Select,
	SelectValue,
	TextArea,
	TextField,
	TimeField,
} from 'react-aria-components';
import { AdminApiError, lookupRecords, saveRecord, type LookupOption } from './api';
import { buildInitialValues, buildPayload, hasUnsavedChanges, type FormValues } from './form-state';
import { editorConfigs, type EditorResource, type FieldConfig, type LookupResource } from './resources';

interface EditorDialogProps {
	resource: EditorResource;
	record?: Record<string, unknown> | undefined;
	defaults?: Record<string, string | boolean> | undefined;
	onClose: () => void;
	onSaved: (record: Record<string, unknown>) => void;
}

export function EditorDialog({ resource, record, defaults = {}, onClose, onSaved }: EditorDialogProps) {
	const config = editorConfigs[resource];
	const initialValues = useMemo(() => ({ ...buildInitialValues(config.fields, record), ...defaults }), [config.fields, defaults, record]);
	const [values, setValues] = useState<FormValues>(initialValues);
	const mutation = useMutation({
		mutationFn: () => saveRecord(resource, buildPayload(config.fields, values), record?.id ? String(record.id) : undefined),
		onSuccess: onSaved,
	});
	const error = mutation.error instanceof AdminApiError ? mutation.error : null;

	useEffect(() => {
		const handleBeforeUnload = (event: BeforeUnloadEvent) => {
			if (hasUnsavedChanges(initialValues, values)) {
				event.preventDefault();
			}
		};
		window.addEventListener('beforeunload', handleBeforeUnload);
		return () => window.removeEventListener('beforeunload', handleBeforeUnload);
	}, [initialValues, values]);

	const requestClose = () => {
		if (hasUnsavedChanges(initialValues, values) && !window.confirm('未保存の変更があります。破棄して閉じますか？')) {
			return;
		}
		onClose();
	};

	const setValue = (key: string, value: string | boolean) => {
		setValues((current) => ({ ...current, [key]: value }));
	};

	return (
		<ModalOverlay
			isOpen
			isDismissable
			className="modal-overlay"
			onOpenChange={(isOpen) => {
				if (!isOpen) requestClose();
			}}
		>
			<Modal className="editor-modal">
				<Dialog aria-label={`${config.singular}を${record ? '編集' : '追加'}`} className="dialog">
					<header className="dialog-header">
						<div>
							<p className="eyebrow">{record ? 'Edit record' : 'New record'}</p>
							<h2>
								{config.singular}を{record ? '編集' : '追加'}
							</h2>
						</div>
						<Button aria-label="閉じる" className="icon-button" onPress={requestClose}>
							<X size={20} />
						</Button>
					</header>

					<form
						className="editor-form"
						onSubmit={(event) => {
							event.preventDefault();
							mutation.mutate();
						}}
					>
						<div className="form-grid">
							{config.fields.map((field) =>
								defaults[field.key] !== undefined ? null : (
									<Field key={field.key} field={field} resource={resource} record={record} values={values} error={error?.body?.error.fields?.[field.key]?.join('、')} onChange={setValue} />
								),
							)}
						</div>

						{error ? (
							<div className="form-error" role="alert">
								<AlertCircle size={18} />
								<div>
									<strong>保存できませんでした</strong>
									<p>{actionableError(error)}</p>
								</div>
							</div>
						) : null}

						<footer className="dialog-actions">
							<Button type="button" className="button secondary" onPress={requestClose}>
								キャンセル
							</Button>
							<Button type="submit" className="button primary" isDisabled={mutation.isPending}>
								{mutation.isPending ? <LoaderCircle className="spin" size={18} /> : <Check size={18} />}
								保存
							</Button>
						</footer>
					</form>
				</Dialog>
			</Modal>
		</ModalOverlay>
	);
}

interface FieldProps {
	field: FieldConfig;
	resource: EditorResource;
	record?: Record<string, unknown> | undefined;
	values: FormValues;
	error?: string | undefined;
	onChange: (key: string, value: string | boolean) => void;
}

function Field({ field, resource, record, values, error, onChange }: FieldProps) {
	const className = field.span === 2 ? 'field span-2' : 'field';

	if (field.type === 'target') {
		return <TargetField className={className} resource={resource} values={values} error={error} onChange={onChange} />;
	}

	if (field.type === 'combobox' && field.lookup) {
		return (
			<LookupField
				className={className}
				label={field.label}
				lookup={field.lookup}
				value={String(values[field.key] ?? '')}
				initialLabel={resolvedLabel(record, field.key)}
				required={field.required}
				error={error}
				onChange={(value) => onChange(field.key, value)}
			/>
		);
	}

	if (field.type === 'select') {
		return (
			<Select className={className} value={String(values[field.key] ?? '') || null} isRequired={field.required ?? false} onChange={(key) => onChange(field.key, key == null ? '' : String(key))}>
				<Label>{field.label}</Label>
				<Button className="select-trigger">
					<SelectValue />
					<ChevronDown size={16} />
				</Button>
				<Popover className="popover">
					<ListBox>
						{(field.options ?? []).map((option) => (
							<ListBoxItem id={option.value} key={option.value} className="option">
								{option.label}
							</ListBoxItem>
						))}
					</ListBox>
				</Popover>
				{error ? <span className="field-error">{error}</span> : null}
			</Select>
		);
	}

	if (field.type === 'checkbox') {
		return (
			<CheckboxField className={`${className} checkbox-field`} isSelected={values[field.key] === true} onChange={(selected) => onChange(field.key, selected)}>
				<CheckboxButton className="checkbox-button">
					<span className="checkbox-box">
						<Check size={14} />
					</span>
					{field.label}
				</CheckboxButton>
			</CheckboxField>
		);
	}

	if (field.type === 'number') {
		const value = Number(values[field.key]);
		return (
			<NumberField
				className={className}
				isRequired={field.required ?? false}
				{...(Number.isFinite(value) && values[field.key] !== '' ? { value } : {})}
				onChange={(next) => onChange(field.key, Number.isNaN(next) ? '' : String(next))}
			>
				<Label>{field.label}</Label>
				<Group className="number-control">
					<Button slot="decrement" aria-label={`${field.label}を減らす`}>
						<Minus size={15} />
					</Button>
					<Input />
					<Button slot="increment" aria-label={`${field.label}を増やす`}>
						<Plus size={15} />
					</Button>
				</Group>
				{error ? <span className="field-error">{error}</span> : null}
			</NumberField>
		);
	}

	if (field.type === 'date' || field.type === 'time') {
		const rawValue = String(values[field.key] ?? '');
		const content = (
			<>
				<Label>{field.label}</Label>
				<DateInput className="date-control">{(segment) => <DateSegment segment={segment} />}</DateInput>
				{error ? <span className="field-error">{error}</span> : null}
			</>
		);

		return field.type === 'date' ? (
			<DateField className={className} isRequired={field.required ?? false} value={rawValue ? parseDate(rawValue) : null} onChange={(next) => onChange(field.key, next?.toString() ?? '')}>
				{content}
			</DateField>
		) : (
			<TimeField className={className} isRequired={field.required ?? false} value={rawValue ? parseTime(rawValue) : null} onChange={(next) => onChange(field.key, next?.toString() ?? '')}>
				{content}
			</TimeField>
		);
	}

	return (
		<TextField className={className} isRequired={field.required ?? false} value={String(values[field.key] ?? '')} onChange={(value) => onChange(field.key, value)}>
			<Label>{field.label}</Label>
			{field.type === 'textarea' ? <TextArea rows={4} /> : <Input type={field.type === 'text' ? 'text' : field.type} {...(field.placeholder ? { placeholder: field.placeholder } : {})} />}
			{error ? <span className="field-error">{error}</span> : null}
		</TextField>
	);
}

interface LookupFieldProps {
	className: string;
	label: string;
	lookup: LookupResource;
	value: string;
	initialLabel?: string | undefined;
	required?: boolean | undefined;
	error?: string | undefined;
	onChange: (value: string) => void;
}

function LookupField({ className, label, lookup, value, initialLabel = '', required, error, onChange }: LookupFieldProps) {
	const [search, setSearch] = useState(initialLabel);
	const [createVenue, setCreateVenue] = useState(false);
	const query = useQuery({
		queryKey: ['admin', 'lookup', lookup, search],
		queryFn: () => lookupRecords(lookup, search),
	});
	const options = useMemo(() => query.data ?? [], [query.data]);

	useEffect(() => {
		if (!search && value) {
			const selected = options.find((option) => option.id === value);
			if (selected) setSearch(selected.label);
		}
	}, [options, search, value]);

	return (
		<>
			<ComboBox<LookupOption>
				className={className}
				inputValue={search}
				items={options}
				value={value || null}
				isRequired={required ?? false}
				menuTrigger="focus"
				allowsEmptyCollection
				onInputChange={setSearch}
				onChange={(key) => {
					const id = key ? String(key) : '';
					onChange(id);
					const selected = options.find((option) => option.id === id);
					if (selected) setSearch(selected.label);
				}}
			>
				<Label>{label}</Label>
				<div className="combo-control">
					<Input placeholder={`${label}を検索`} />
					{lookup === 'venue' ? (
						<Button type="button" aria-label="会場を追加" onPress={() => setCreateVenue(true)}>
							<Plus size={16} />
						</Button>
					) : null}
					<Button aria-label="候補を表示">
						<ChevronDown size={16} />
					</Button>
				</div>
				<Popover className="popover">
					<ListBox<LookupOption> className="lookup-list">
						{(option) => (
							<ListBoxItem id={option.id} textValue={option.label} className="option">
								<span>{option.label}</span>
								{option.description ? <small>{option.description}</small> : null}
							</ListBoxItem>
						)}
					</ListBox>
				</Popover>
				{error ? <span className="field-error">{error}</span> : null}
			</ComboBox>
			{createVenue ? (
				<EditorDialog
					resource="venues"
					onClose={() => setCreateVenue(false)}
					onSaved={(record) => {
						onChange(String(record.id));
						setSearch(String(record.name));
						setCreateVenue(false);
					}}
				/>
			) : null}
		</>
	);
}

function TargetField({
	className,
	resource,
	values,
	error,
	onChange,
}: {
	className: string;
	resource: EditorResource;
	values: FormValues;
	error?: string | undefined;
	onChange: (key: string, value: string) => void;
}) {
	const isContribution = resource === 'contributions';
	const targetOptions = isContribution
		? [
				{ value: 'release', label: 'リリース', lookup: 'release' as const },
				{ value: 'recording', label: '録音', lookup: 'recording' as const },
				{ value: 'event', label: 'イベント', lookup: 'event' as const },
			]
		: [
				{ value: 'work', label: '作品', lookup: 'work' as const },
				{ value: 'event', label: 'イベント', lookup: 'event' as const },
				{ value: 'person', label: '人物', lookup: 'person' as const },
			];
	const fallbackType = targetOptions[0]!.value;
	const type = targetOptions.some((option) => option.value === values.targetType) ? String(values.targetType) : fallbackType;
	const lookup = targetOptions.find((option) => option.value === type)?.lookup ?? targetOptions[0]!.lookup;

	useEffect(() => {
		if (values.targetType !== type) {
			onChange('targetType', type);
		}
	}, [onChange, type, values.targetType]);

	return (
		<div className={`${className} target-fields`}>
			<Select
				className="field"
				value={type}
				onChange={(key) => {
					onChange('targetType', key == null ? '' : String(key));
					onChange('targetId', '');
				}}
			>
				<Label>対象種別</Label>
				<Button className="select-trigger">
					<SelectValue />
					<ChevronDown size={16} />
				</Button>
				<Popover className="popover">
					<ListBox>
						{targetOptions.map((option) => (
							<ListBoxItem id={option.value} key={option.value} className="option">
								{option.label}
							</ListBoxItem>
						))}
					</ListBox>
				</Popover>
			</Select>
			<LookupField className="field" label="対象" lookup={lookup} value={String(values.targetId ?? '')} required error={error} onChange={(value) => onChange('targetId', value)} />
		</div>
	);
}

function resolvedLabel(record: Record<string, unknown> | undefined, key: string): string {
	if (!record) return '';
	const nameKey = key.replace(/Id$/, 'Name');
	return String(record[nameKey] ?? '');
}

function actionableError(error: AdminApiError): string {
	switch (error.body?.error.code) {
		case 'CONFLICT':
			return '同じ値を持つレコードがすでにあります。入力内容を確認してください。';
		case 'INVALID_REFERENCE':
			return '選択した関連レコードが見つかりません。候補を選び直してください。';
		case 'CONSTRAINT_VIOLATION':
			return '日付の前後関係など、入力値の組み合わせを確認してください。';
		default:
			return error.message;
	}
}
